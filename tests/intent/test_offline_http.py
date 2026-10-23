"""Real loopback HTTP application; only the completion transport is a fixture."""

import http.client
import json
import socket
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from unittest.mock import Mock

import pytest
import uvicorn

from torob.api import create_app
from torob.config import Settings
from torob.data.importer import import_dataset

from .conftest import extracted

PATH = "/api/v1/journey/intents"


@pytest.fixture
def offline_http(tmp_path, provider, monkeypatch):
    db = tmp_path / "catalog.sqlite3"
    import_dataset(
        Path(__file__).resolve().parents[2] / "datasets/sample", db, source_kind="sample"
    )
    app = create_app(Settings(db_path=db))
    original_lifespan = app.router.lifespan_context
    search = Mock(side_effect=AssertionError("No search is allowed during intake"))

    @asynccontextmanager
    async def fixture_lifespan(application):
        async with original_lifespan(application):
            application.state.intent._interpreter_factory = provider.interpreter
            monkeypatch.setattr(application.state.catalog, "search", search)
            yield

    app.router.lifespan_context = fixture_lifespan
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(128)
        server = uvicorn.Server(
            uvicorn.Config(app, loop="asyncio", log_config=None, access_log=False)
        )
        thread = threading.Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
        thread.start()
        try:
            deadline = time.monotonic() + 10
            while not server.started and thread.is_alive() and time.monotonic() < deadline:
                time.sleep(0.01)
            assert server.started

            def post(path, payload, headers=None):
                # Direct loopback connection: no proxy/netrc or credential environment.
                connection = http.client.HTTPConnection(
                    "127.0.0.1", listener.getsockname()[1], timeout=5
                )
                try:
                    connection.request(
                        "POST",
                        path,
                        body=json.dumps(payload).encode(),
                        headers={"Content-Type": "application/json", **(headers or {})},
                    )
                    response = connection.getresponse()
                    return response.status, json.loads(response.read())
                finally:
                    connection.close()

            yield post, app, search
        finally:
            server.should_exit = True
            thread.join(timeout=10)
            assert not thread.is_alive(), "Task-owned HTTP server did not stop"


@pytest.mark.parametrize("digits", ["40", "۴۰"])
def test_observed_message_over_real_http_uses_offline_completion_and_clarifies(
    offline_http, provider, digits
):
    post, _app, search = offline_http
    provider.output = extracted(
        product_query="گوشی سامسونگ", brand="سامسونگ", max_budget=f"{digits} میلیون تومان"
    )
    status, created = post(PATH, {"message": f"گوشی سامسونگ تا {digits} میلیون تومان میخوام"})
    assert status == 201
    draft = created["draft"]
    assert draft["status"] == "needs_clarification"
    assert draft["criteria"]["max_budget"] == "40000000"
    assert draft["criteria"]["price_unit"] == "TOMAN"
    assert draft["search_performed"] is False
    assert {issue["field"] for issue in draft["issues"]} == {"coordinates", "radius"}
    headers = {"Authorization": "Bearer " + created["access_token"]}
    for suffix, payload in (
        ("confirm", {"expected_revision": 0, "confirm": True}),
        ("recommendations", {"expected_revision": 0}),
    ):
        status, error = post(f"{PATH}/{draft['draft_id']}/{suffix}", payload, headers)
        assert status == 409 and error["error"]["code"] == "confirmation_required"
    search.assert_not_called()
    assert len(provider.calls) == 1


@pytest.mark.parametrize(
    ("finish", "code", "reason"),
    [
        ("stop", "invalid_interpretation", "invalid_json"),
        ("length", "llm_incomplete_response", "llm_incomplete_response"),
        (None, "invalid_interpretation", "non_stop_finish_reason"),
    ],
)
def test_broken_or_truncated_completion_over_http_has_safe_diagnostics_and_no_draft(
    offline_http, provider, caplog, finish, code, reason
):
    post, app, search = offline_http
    provider.output, provider.reason = '{"shopping_related":', finish
    status, error = post(PATH, {"message": "گوشی سامسونگ تا 40 میلیون تومان میخوام"})
    assert status == 502 and error["error"]["code"] == code
    assert "draft" not in error and "access_token" not in error
    assert error["error"]["details"] == []
    assert f"reason={reason}" in caplog.text
    assert "max_output_tokens=1024" in caplog.text
    for private in (provider.output, "unit-test-key", "Authorization", "میخوام"):
        assert private not in caplog.text + json.dumps(error, ensure_ascii=False)
    with app.state.intent.store.connection() as connection:
        assert connection.execute("SELECT COUNT(*) FROM intents").fetchone()[0] == 0
    search.assert_not_called()
    assert len(provider.calls) == 1
