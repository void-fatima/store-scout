import json
from unittest.mock import Mock

import pytest

from torob.journey.intent.errors import IntentError
from torob.journey.recommendations import JourneyRecommendations, run_recommendations

from .conftest import extracted
from .test_service import MESSAGE, READY

PATH = "/api/v1/journey/intents"


def create(client, message=MESSAGE):
    response = client.post(PATH, json={"message": message})
    assert response.status_code == 201, response.text
    data = response.json()
    return data["draft"], {"Authorization": "Bearer " + data["access_token"]}


def revise(client, draft, headers, changes=READY):
    return client.post(
        f"{PATH}/{draft['draft_id']}/revise",
        headers=headers,
        json={
            "expected_revision": draft["revision"],
            "changes": changes,
        },
    )


def test_real_sample_catalog_only_after_explicit_confirmation(intent_client, provider, monkeypatch):
    client = intent_client
    repository = client.app.state.catalog
    real_search = repository.search
    search = Mock(wraps=real_search)
    monkeypatch.setattr(repository, "search", search)
    draft, headers = create(client)
    assert draft["status"] == "needs_clarification" and not draft["search_performed"]
    search.assert_not_called()
    prefix = f"{PATH}/{draft['draft_id']}"
    assert (
        client.post(
            prefix + "/recommendations", headers=headers, json={"expected_revision": 0}
        ).status_code
        == 409
    )
    assert (
        client.post(
            prefix + "/confirm", headers=headers, json={"expected_revision": 0, "confirm": True}
        ).status_code
        == 409
    )
    ready = revise(client, draft, headers)
    assert ready.status_code == 200, ready.text
    prepared = ready.json()
    assert prepared["status"] == "awaiting_confirmation"
    search.assert_not_called()
    for value in (False, "true", 1):
        assert (
            client.post(
                prefix + "/confirm",
                headers=headers,
                json={"expected_revision": 1, "confirm": value},
            ).status_code
            == 422
        )
    confirmed = client.post(
        prefix + "/confirm", headers=headers, json={"expected_revision": 1, "confirm": True}
    )
    assert confirmed.status_code == 200 and confirmed.json()["status"] == "confirmed"
    search.assert_not_called()
    response = client.post(
        prefix + "/recommendations", headers=headers, json={"expected_revision": 1}
    )
    assert response.status_code == 200, response.text
    actual = JourneyRecommendations.model_validate(response.json())
    assert actual.state.request_id == draft["draft_id"] and actual.state.revision == 1
    assert actual.state.criteria.max_budget == 30_000_000
    assert actual.result.original_constraints.budget_toman == 30_000_000
    assert search.call_count >= 1
    from torob.journey.models import ShoppingRequest

    request = ShoppingRequest.model_validate(
        {"request_id": draft["draft_id"], "revision": 1, "criteria": prepared["criteria"]}
    )
    expected = run_recommendations(repository, request)
    assert actual == expected
    from torob.catalog.contracts import CatalogQuery

    records = repository.search(
        CatalogQuery(
            q="گوشی سامسونگ",
            max_price_toman=30_000_000,
            lat=35.7,
            lon=51.4,
            radius_km=5,
        )
    )
    assert actual.result.original.recommendations
    assert {result.offer_id for result in actual.result.original.recommendations} <= {
        candidate.offer_id for candidate in records.items
    }
    assert actual.result.original.context == repository.context()
    assert all(
        item.before_visit_verification.availability == "unconfirmed"
        for item in actual.result.original.recommendations
    )
    assert len(provider.calls) == 1


def test_capability_is_required_and_other_session_cannot_access(intent_client):
    draft, headers = create(intent_client)
    path = f"{PATH}/{draft['draft_id']}"
    for unauthorized in ({}, {"Authorization": "Bearer different-session"}):
        for suffix, body in (
            ("", None),
            ("/confirm", {"expected_revision": 0, "confirm": True}),
            ("/reject", {"expected_revision": 0}),
            ("/recommendations", {"expected_revision": 0}),
        ):
            response = (
                intent_client.get(path, headers=unauthorized)
                if body is None
                else intent_client.post(path + suffix, headers=unauthorized, json=body)
            )
            assert response.status_code == 404
    response = intent_client.get(path, headers=headers)
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    assert "access_token" not in response.json()


def test_stale_confirmation_rejection_and_revision_state_machine(intent_client):
    draft, headers = create(intent_client)
    path = f"{PATH}/{draft['draft_id']}"
    assert revise(intent_client, draft, headers).status_code == 200
    assert (
        intent_client.post(
            path + "/confirm", headers=headers, json={"expected_revision": 0, "confirm": True}
        ).status_code
        == 409
    )
    assert (
        intent_client.post(
            path + "/confirm", headers=headers, json={"expected_revision": 1, "confirm": True}
        ).status_code
        == 200
    )
    updated = revise(
        intent_client, {**draft, "revision": 1}, headers, {"max_budget": "۴۰ میلیون تومان"}
    )
    assert updated.json()["status"] == "awaiting_confirmation"
    for version in (1, 2):
        assert (
            intent_client.post(
                path + "/recommendations", headers=headers, json={"expected_revision": version}
            ).status_code
            == 409
        )
    rejected = intent_client.post(path + "/reject", headers=headers, json={"expected_revision": 2})
    assert rejected.json()["status"] == "rejected" and rejected.json()["revision"] == 3
    assert (
        intent_client.post(
            path + "/confirm", headers=headers, json={"expected_revision": 3, "confirm": True}
        ).status_code
        == 409
    )


def test_natural_clarification_preserves_existing_constraints(intent_client, provider):
    provider.output = extracted(
        product_query="گوشی سامسونگ", max_budget="۳۰ تومن", location="صادقیه"
    )
    draft, headers = create(intent_client, "گوشی سامسونگ تا ۳۰ تومن نزدیک صادقیه")
    assert draft["max_budget"]["requires_clarification"] and draft["criteria"]["max_budget"] is None
    provider.output = extracted(max_budget="۳۰ میلیون تومان")
    response = intent_client.post(
        f"{PATH}/{draft['draft_id']}/revise",
        headers=headers,
        json={
            "expected_revision": 0,
            "message": "منظورم ۳۰ میلیون تومان بود",
        },
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["criteria"]["max_budget"] == "30000000"
    assert (
        updated["fields"]["location"] == "صادقیه"
        and updated["fields"]["product_query"] == "گوشی سامسونگ"
    )
    assert updated["fields"]["coordinates"] is None


@pytest.mark.parametrize(
    ("changes", "status"),
    [
        ({"max_budget": -1}, 422),
        ({"radius": -1}, 422),
        ({"radius": "-۲ کیلومتر"}, 422),
        ({"radius": "۱۰۱ کیلومتر"}, 422),
        ({"coordinates": {"latitude": 91.0, "longitude": 51.4}}, 422),
        ({"coordinates": {"latitude": True, "longitude": 51.4}}, 422),
        ({"min_budget": "۴۰ میلیون تومان"}, 422),
        ({"max_budget": "-۳۰ میلیون تومان"}, 422),
        ({"payment_methods": ["crypto"]}, 422),
        ({"confirmed": True}, 422),
        ({"other_preferences": ["فقط ارسال رایگان"]}, 200),
    ],
)
def test_invalid_or_unsupported_changes_cannot_execute(intent_client, changes, status):
    draft, headers = create(intent_client)
    response = revise(intent_client, draft, headers, changes)
    assert response.status_code == status
    if status == 200:
        assert any(issue["code"] == "unsupported" for issue in response.json()["issues"])
    else:
        state = intent_client.get(f"{PATH}/{draft['draft_id']}", headers=headers).json()
        assert state["revision"] == 0


@pytest.mark.parametrize(
    ("failure", "status", "code"),
    [
        (TimeoutError("unit-test-key"), 504, "llm_timeout"),
        (RuntimeError("unit-test-key"), 503, "llm_transport_error"),
        (401, 503, "llm_authentication"),
        (403, 503, "llm_model_access"),
        (404, 503, "llm_model_access"),
        (429, 429, "llm_rate_limit"),
        (500, 503, "llm_provider_unavailable"),
    ],
)
def test_provider_failures_safe_and_existing_catalog_unaffected(
    intent_client, provider, failure, status, code
):
    if isinstance(failure, Exception):
        provider.error = failure
    else:
        provider.status = failure
    response = intent_client.post(PATH, json={"message": MESSAGE})
    assert response.status_code == status and response.json()["error"]["code"] == code
    assert "unit-test-key" not in response.text and "Authorization" not in response.text
    assert len(provider.calls) == 1
    assert intent_client.get("/health").status_code == 200
    assert intent_client.get("/api/v1/catalog/offers", params={"q": "گوشی"}).status_code == 200


@pytest.mark.parametrize(
    "raw", ["{", '{"message": 123}', '{"message": ""}', '{"message":"گوشی","confirmed":true}']
)
def test_malformed_request_safe_and_provider_not_called(intent_client, provider, raw):
    response = intent_client.post(
        PATH, content=raw.encode(), headers={"Content-Type": "application/json"}
    )
    assert (
        response.status_code == 422 and response.json()["error"]["code"] == "invalid_intent_request"
    )
    assert provider.calls == []


def test_large_request_is_rejected_before_model_and_error_does_not_echo_input(
    intent_client, provider
):
    raw = json.dumps({"message": "unit-test-key" * 3000})
    response = intent_client.post(PATH, content=raw, headers={"Content-Type": "application/json"})
    assert response.status_code == 413 and "unit-test-key" not in response.text
    assert provider.calls == []


def test_local_quota_and_capacity_return_clear_safe_failures(intent_client, provider):
    service = intent_client.app.state.intent
    service.store.calls_per_minute = 1
    create(intent_client)
    response = intent_client.post(PATH, json={"message": MESSAGE})
    assert response.status_code == 429 and len(provider.calls) == 1


def test_future_frontend_preflight_supports_capability_header(intent_client):
    response = intent_client.options(
        PATH + "/" + "a" * 32 + "/confirm",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Authorization, Content-Type",
        },
    )
    assert response.status_code == 200
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_unconfigured_provider_only_affects_intent_endpoints(client, monkeypatch):
    monkeypatch.delenv("STORE_SCOUT_LLM_OUTPUT_LIMIT_PARAMETER", raising=False)
    response = client.post(PATH, json={"message": MESSAGE})
    assert (
        response.status_code == 503
        and response.json()["error"]["code"] == "llm_invalid_configuration"
    )
    assert client.get("/health").status_code == 200
    assert client.get("/api/v1/catalog/offers").status_code == 200


@pytest.mark.parametrize("reason", ["length", "content_filter", None])
def test_incomplete_model_output_never_produces_a_draft(intent_client, provider, reason):
    provider.reason = reason
    response = intent_client.post(PATH, json={"message": MESSAGE})
    assert response.status_code == 502 and "draft" not in response.json()
    assert len(provider.calls) == 1


def test_failed_reinterpretation_does_not_modify_confirmed_state(intent_client, provider):
    draft, headers = create(intent_client)
    prepared = revise(intent_client, draft, headers).json()
    path = f"{PATH}/{draft['draft_id']}"
    assert (
        intent_client.post(
            path + "/confirm",
            headers=headers,
            json={
                "expected_revision": prepared["revision"],
                "confirm": True,
            },
        ).status_code
        == 200
    )
    provider.output = '{"untrusted": "unit-test-key"}'
    response = intent_client.post(
        path + "/revise",
        headers=headers,
        json={
            "expected_revision": 1,
            "message": "بودجه را تغییر بده",
        },
    )
    assert response.status_code == 502 and "unit-test-key" not in response.text
    actual = intent_client.get(path, headers=headers).json()
    assert actual["status"] == "confirmed" and actual["revision"] == 1
    assert actual["criteria"] == prepared["criteria"]


def test_rial_budget_forwarded_exactly_and_unsupported_minimum_can_be_explicitly_removed(
    intent_client, provider
):
    provider.output = extracted(
        product_query="گوشی سامسونگ", max_budget="۳۰۰ میلیون ریال", min_budget="۱۰۰ میلیون ریال"
    )
    draft, headers = create(intent_client, "گوشی سامسونگ از ۱۰۰ میلیون ریال تا ۳۰۰ میلیون ریال")
    assert draft["min_budget"]["toman"] == 10_000_000
    assert any(
        issue["field"] == "min_budget" and issue["code"] == "unsupported"
        for issue in draft["issues"]
    )
    updated = revise(intent_client, draft, headers, {**READY, "min_budget": None})
    assert updated.status_code == 200 and updated.json()["status"] == "awaiting_confirmation"
    path = f"{PATH}/{draft['draft_id']}"
    assert (
        intent_client.post(
            path + "/confirm", headers=headers, json={"expected_revision": 1, "confirm": True}
        ).status_code
        == 200
    )
    result = intent_client.post(
        path + "/recommendations", headers=headers, json={"expected_revision": 1}
    )
    assert result.status_code == 200
    constraints = result.json()["result"]["original_constraints"]
    assert constraints["max_budget"] == "300000000" and constraints["price_unit"] == "IRR"


def test_capacity_is_enforced_without_evicting_existing_draft(service):
    service.store.capacity = 1
    created = service.create(MESSAGE)
    with pytest.raises(IntentError) as error:
        service.create(MESSAGE)
    assert error.value.response.error.code == "intent_capacity"
    assert service.get(created.draft.draft_id, created.access_token) == created.draft
