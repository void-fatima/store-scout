import json

from torob.journey import prepare_catalog_request, start_journey, update_criteria


def test_complete_journey_flow_cannot_use_network_database_files_or_processes(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Shopping preparation must stay offline and side-effect free")

    for target in (
        "socket.socket",
        "socket.create_connection",
        "sqlite3.connect",
        "subprocess.Popen",
        "os.system",
        "builtins.open",
        "io.open",
    ):
        monkeypatch.setattr(target, forbidden)

    created = start_journey({"request_id": "sample-flow", "criteria": {"q": "گوشی"}})
    completed = update_criteria(created.state, {"city": "تهران", "area": "ونک"})
    changed = update_criteria(completed.state, {"max_price_toman": 20_000_000})
    prepared = prepare_catalog_request(changed.state)
    invalid = update_criteria(changed.state, {"max_price_toman": "20000000"})
    for result in (created, completed, changed, prepared, invalid):
        payload = json.loads(result.model_dump_json())
        assert payload["search_performed"] is False
        assert payload["state"]["search_performed"] is False
        assert "items" not in payload and "total" not in payload
    assert prepared.catalog_request.handoff_ready is False
    assert prepared.catalog_request.criteria.area == "ونک"
    assert prepared.catalog_request.parameters["max_price_toman"] == 20_000_000


def test_changed_criteria_invalidate_preparation_without_mutating_previous_request():
    created = start_journey(
        {
            "request_id": "sample-flow",
            "criteria": {"q": "گوشی", "city": "تهران", "max_price_toman": 20_000_000},
        }
    )
    prepared = prepare_catalog_request(created.state)
    snapshot = prepared.model_dump(mode="json")
    updated = update_criteria(prepared.state, {"max_price_toman": 25_000_000})
    assert updated.state.status == "criteria_ready"
    assert updated.catalog_request is None
    assert updated.state.request_id == prepared.state.request_id
    assert prepared.model_dump(mode="json") == snapshot
    next_request = prepare_catalog_request(updated.state).catalog_request
    assert next_request.parameters["max_price_toman"] == 25_000_000
    assert prepared.catalog_request.parameters["max_price_toman"] == 20_000_000
