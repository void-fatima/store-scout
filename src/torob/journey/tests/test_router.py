"""The router runs in a test-owned app; production registration stays coordinated."""

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from torob.api import create_app
from torob.catalog.contracts import ErrorResponse
from torob.journey.models import ShoppingRequest
from torob.journey.recommendations import (
    AlternativeAcceptance,
    JourneyRecommendations,
    accept_alternative,
    comparison_keys,
    select_for_comparison,
)
from torob.journey.router import router
from torob.recommend.service import RecommendationServiceError

PATH = "/api/v1/journey/recommendations"


def test_app(source=None, *, cors=False):
    """Factory only, not a test or a second application entrypoint."""
    app = FastAPI()
    if source is not None:
        app.state.catalog = source
    app.include_router(router)
    if cors:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:5173"],
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type"],
        )
    return app


test_app.__test__ = False


def body(state):
    return ShoppingRequest.model_validate(
        state.model_dump(include=set(ShoppingRequest.model_fields))
    ).model_dump(mode="json")


def test_success_returns_intact_canonical_payload_and_identified_revision(
    journey_repository, journey_request
):
    with TestClient(test_app(journey_repository)) as client:
        result = client.post(PATH, json=body(journey_request()))
    assert result.status_code == 200
    response = JourneyRecommendations.model_validate_json(result.content)
    assert response.state.request_id == "sample-journey" and response.state.revision == 2
    assert result.json()["result"] == response.result.model_dump(mode="json")
    assert response.result.original.context == journey_repository.context()
    assert len(response.result.original.recommendations) == 2


@pytest.mark.parametrize(
    "patch",
    [
        {"unexpected": "secret-do-not-echo"},
        {"request_id": None},
        {"revision": True},
        {"criteria": {"q": "گوشی", "max_budget": 123.45, "price_unit": "IRR"}},
        {"criteria": {"q": "گوشی", "shopping_time": "2026-10-24T10:00:00"}},
    ],
)
def test_invalid_body_is_canonical_json_safe_and_does_not_echo_input(
    patch, journey_repository, journey_request
):
    with TestClient(test_app(journey_repository)) as client:
        result = client.post(PATH, json=body(journey_request()) | patch)
    assert result.status_code == 422
    error = ErrorResponse.model_validate(result.json()).error
    assert error.code == "invalid_request" and error.details
    assert "secret-do-not-echo" not in result.text
    assert all("input" not in detail and "ctx" not in detail for detail in error.details)


def test_malformed_json_uses_canonical_validation_error(journey_repository):
    with TestClient(test_app(journey_repository)) as client:
        result = client.post(
            PATH, content='{"request_id":', headers={"Content-Type": "application/json"}
        )
    assert result.status_code == 422
    assert ErrorResponse.model_validate(result.json()).error.code == "invalid_request"


@pytest.mark.parametrize(
    "criteria,code",
    [
        ({"latitude": None, "longitude": None, "max_distance_km": None}, "missing_information"),
        ({"area": "ونک"}, "unsupported_constraint"),
        ({"city": "تهران"}, "unsupported_constraint"),
    ],
)
def test_location_errors_preserve_actionable_constraint_details(
    criteria, code, journey_repository, journey_request
):
    with TestClient(test_app(journey_repository)) as client:
        result = client.post(PATH, json=body(journey_request(**criteria)))
    assert result.status_code == 422
    assert result.json()["error"]["code"] == code
    assert result.json()["error"]["details"]


@pytest.mark.parametrize("query", ["محصول ناموجود", "گوشی سامسونگ"])
def test_empty_and_alternatives_are_successful_without_automatically_applying_changes(
    query, journey_repository, journey_request
):
    with TestClient(test_app(journey_repository)) as client:
        result = client.post(PATH, json=body(journey_request(q=query, max_price_toman=18_000_000)))
    assert result.status_code == 200
    response = result.json()
    assert not response["result"]["original"]["recommendations"]
    assert response["state"]["criteria"]["max_price_toman"] == 18_000_000
    assert bool(response["result"]["suggestions"]) == (query == "گوشی سامسونگ")


def test_comparison_json_roundtrip_and_explicit_acceptance_require_new_post(
    journey_repository, journey_request
):
    with TestClient(test_app(journey_repository)) as client:
        first = JourneyRecommendations.model_validate(
            client.post(PATH, json=body(journey_request(max_price_toman=18_000_000))).json()
        )
        selected = select_for_comparison(first, comparison_keys(first.result)[:1])
        rerun = client.post(PATH, json=body(selected.state))
        assert rerun.status_code == 200
        assert rerun.json()["state"]["comparison"]["keys"]
        suggestion = first.result.suggestions[0]
        fresh = accept_alternative(
            first,
            AlternativeAcceptance(
                request_id=first.state.request_id,
                expected_revision=first.state.revision,
                dataset_id=first.result.original.context.dataset.dataset_id,
                offer_id=suggestion.result.offer_id,
                accepted_changes=tuple(suggestion.changes),
            ),
            current_state=selected.state,
        )
        response = client.post(PATH, json=body(fresh))
    assert response.status_code == 200
    assert response.json()["state"]["revision"] == 3
    assert response.json()["state"]["comparison"] is None
    assert response.json()["result"]["original"]["recommendations"]


def test_actual_snapshot_failure_has_canonical_retryable_409(journey_repository, journey_request):
    class ChangingSnapshot:
        calls = 0

        def search(self, query):
            self.calls += 1
            page = journey_repository.search(query)
            data = page.model_dump()
            if self.calls > 1:
                data["context"]["dataset"]["dataset_id"] = "changed"
            return type(page).model_validate(data)

    with TestClient(test_app(ChangingSnapshot())) as client:
        response = client.post(PATH, json=body(journey_request(max_price_toman=18_000_000)))
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "catalog_snapshot_changed"
    assert response.json()["error"]["details"] == [{"retryable": True}]
    assert "result" not in response.json()


def test_actual_upstream_exception_is_hidden(journey_request):
    class FailedSource:
        def search(self, query):
            raise RuntimeError("private SQL and file path")

    with TestClient(test_app(FailedSource())) as client:
        response = client.post(PATH, json=body(journey_request()))
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "catalog_unavailable"
    assert "private SQL" not in response.text


@pytest.mark.parametrize(
    "code,status",
    [
        ("catalog_time_limit", 504),
        ("catalog_invalid_response", 502),
        ("invalid_recommendation_data", 502),
        ("invalid_recommendation_input", 422),
    ],
)
def test_service_errors_keep_canonical_response(
    code, status, monkeypatch, journey_repository, journey_request
):
    error = RecommendationServiceError(
        code, "Safe public message.", retryable=code == "catalog_time_limit"
    )

    def fail(*args, **kwargs):
        raise error

    monkeypatch.setattr("torob.journey.router.run_recommendations", fail)
    with TestClient(test_app(journey_repository)) as client:
        response = client.post(PATH, json=body(journey_request()))
    assert response.status_code == status
    assert response.json() == error.response.model_dump(mode="json")


def test_unconfigured_source_and_unexpected_failures_are_canonical(
    journey_request, monkeypatch, journey_repository
):
    with TestClient(test_app()) as client:
        response = client.post(PATH, json=body(journey_request()))
    assert response.status_code == 503

    def fail(*args, **kwargs):
        raise RuntimeError("private implementation detail")

    monkeypatch.setattr("torob.journey.router.run_recommendations", fail)
    with TestClient(test_app(journey_repository)) as client:
        response = client.post(PATH, json=body(journey_request()))
    assert response.status_code == 500
    assert ErrorResponse.model_validate(response.json()).error.code == "internal_error"
    assert "private implementation" not in response.text


def test_proposed_wiring_supports_post_preflight_and_production_remains_unregistered(
    journey_repository,
):
    with TestClient(test_app(journey_repository, cors=True)) as client:
        response = client.options(
            PATH,
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
    assert response.status_code == 200
    assert "POST" in response.headers["access-control-allow-methods"]
    schema = test_app(journey_repository).openapi()
    assert (
        schema["paths"][PATH]["post"]["responses"]["422"]["description"] == "Unprocessable Content"
    )
    assert "AlternativesResponse" in schema["components"]["schemas"]
    assert PATH not in create_app().openapi()["paths"]
