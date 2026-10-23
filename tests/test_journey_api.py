"""Exercise Journey through the production application and its Catalog lifespan."""

from pathlib import Path
from shutil import copytree

import pytest

from torob.catalog.contracts import ErrorResponse
from torob.catalog.repository import CatalogRepository
from torob.data.importer import import_dataset
from torob.journey.recommendations import JourneyRecommendations

PATH = "/api/v1/journey/recommendations"
SAMPLE = Path(__file__).resolve().parents[1] / "datasets" / "sample"
ORIGIN = "http://localhost:5173"


@pytest.fixture
def shopping_request():
    return {
        "request_id": "sample-http-request",
        "revision": 2,
        "criteria": {
            "q": "گوشی سامسونگ",
            "max_budget": "200000000",
            "price_unit": "IRR",
            "latitude": 35.7,
            "longitude": 51.4,
            "max_distance_km": 5.0,
        },
        "comparison": None,
    }


def test_journey_uses_application_catalog_and_preserves_canonical_response(
    client, shopping_request
):
    repository = client.app.state.catalog
    assert isinstance(repository, CatalogRepository)
    catalog = client.get(
        "/api/v1/catalog/offers",
        params={
            "q": shopping_request["criteria"]["q"],
            "max_price_toman": 20_000_000,
            "lat": 35.7,
            "lon": 51.4,
            "radius_km": 5,
        },
    ).json()
    response = client.post(PATH, json=shopping_request, headers={"Origin": ORIGIN})
    assert response.status_code == 200
    result = JourneyRecommendations.model_validate_json(response.content)
    assert result.state.request_id == shopping_request["request_id"]
    assert result.state.revision == 2
    assert result.state.status == "recommendations_ready"
    assert result.state.search_performed is True
    assert result.state.criteria.model_dump(mode="json")["max_budget"] == "200000000"
    assert result.result.original_constraints.budget_toman == 20_000_000
    recommendations = result.result.original.recommendations
    assert len(recommendations) == 2
    assert {item.offer_id for item in recommendations} == {
        item["offer_id"] for item in catalog["items"]
    }
    assert response.json()["result"]["original"]["context"] == catalog["context"]
    assert result.result.original.context == repository.context()
    assert client.app.state.catalog is repository
    assert response.headers["access-control-allow-origin"] == ORIGIN


def test_empty_journey_result_is_a_success(client, shopping_request):
    shopping_request["criteria"]["q"] = "محصول ناموجود"
    response = client.post(PATH, json=shopping_request)
    assert response.status_code == 200
    result = JourneyRecommendations.model_validate_json(response.content)
    assert result.result.original.recommendations == []
    assert result.result.suggestions == []
    assert result.result.original.context == client.app.state.catalog.context()
    assert result.state.search_performed is True


def test_alternatives_do_not_silently_change_requested_budget(client, shopping_request):
    shopping_request["criteria"]["max_budget"] = "180000000"
    response = client.post(PATH, json=shopping_request)
    assert response.status_code == 200
    result = JourneyRecommendations.model_validate_json(response.content)
    assert not result.result.original.recommendations
    assert result.result.suggestions
    assert result.result.original_constraints.budget_toman == 18_000_000
    assert result.state.criteria.max_budget == 180_000_000
    assert result.state.revision == 2
    assert result.state.comparison is None


@pytest.mark.parametrize(
    "criteria,code",
    [
        ({"latitude": 91}, "invalid_request"),
        ({"max_budget": 123.45}, "invalid_request"),
        ({"q": None}, "missing_information"),
        ({"city": "تهران"}, "unsupported_constraint"),
    ],
)
def test_journey_errors_keep_their_envelope_in_the_main_app(
    client, shopping_request, criteria, code
):
    shopping_request["criteria"].update(criteria)
    response = client.post(PATH, json=shopping_request, headers={"Origin": ORIGIN})
    assert response.status_code == 422
    error = ErrorResponse.model_validate(response.json()).error
    assert error.code == code
    assert error.details
    assert "result" not in response.json()
    assert response.headers["access-control-allow-origin"] == ORIGIN


def test_malformed_journey_json_uses_route_validation_in_the_main_app(client):
    response = client.post(
        PATH, content='{"request_id":', headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422
    assert ErrorResponse.model_validate(response.json()).error.code == "invalid_request"
    catalog_error = client.get("/api/v1/catalog/offers", params={"page": 0})
    assert catalog_error.status_code == 422
    assert catalog_error.json()["error"]["code"] == "invalid_query"


def test_snapshot_replacement_returns_409_and_allows_a_fresh_retry(
    client, db_path, tmp_path, shopping_request, monkeypatch
):
    replacement = copytree(SAMPLE, tmp_path / "replacement-sample")
    # Change the source fingerprint without changing the offers' meaning.
    with (replacement / "offers.csv").open("ab") as stream:
        stream.write(b"\n")
    repository = client.app.state.catalog
    original_search = repository.search
    old_dataset = repository.context().dataset.dataset_id
    calls = 0

    def search_with_reimport(query):
        nonlocal calls
        calls += 1
        if calls == 2:
            import_dataset(replacement, db_path, source_kind="sample", replace=True)
        return original_search(query)

    monkeypatch.setattr(repository, "search", search_with_reimport)
    shopping_request["criteria"]["max_budget"] = "180000000"
    response = client.post(PATH, json=shopping_request)
    assert calls >= 2
    assert repository.context().dataset.dataset_id != old_dataset
    assert response.status_code == 409
    error = ErrorResponse.model_validate(response.json()).error
    assert error.code == "catalog_snapshot_changed"
    assert error.details == [{"retryable": True}]
    assert "result" not in response.json()

    monkeypatch.setattr(repository, "search", original_search)
    retry = client.post(PATH, json=shopping_request)
    assert retry.status_code == 200
    result = JourneyRecommendations.model_validate_json(retry.content)
    assert result.result.original.context == repository.context()


@pytest.mark.parametrize("origin", ["http://localhost:3000", ORIGIN])
def test_main_app_allows_post_preflight_for_configured_origins(client, origin):
    response = client.options(
        PATH,
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert {"GET", "POST"} <= set(response.headers["access-control-allow-methods"].split(", "))
    assert "content-type" in response.headers["access-control-allow-headers"].lower()


def test_main_app_rejects_unconfigured_cors_origin_and_method(client):
    for origin, method in [("https://unrelated.example", "POST"), (ORIGIN, "DELETE")]:
        response = client.options(
            PATH,
            headers={"Origin": origin, "Access-Control-Request-Method": method},
        )
        assert response.status_code == 400
        if origin != ORIGIN:
            assert "access-control-allow-origin" not in response.headers
