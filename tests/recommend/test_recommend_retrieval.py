import json

import pytest

from torob.catalog.contracts import CatalogPage, CatalogQuery
from torob.catalog.repository import CatalogRepository
from torob.recommend.catalog import (
    CatalogAPIClient,
    CatalogRetrievalError,
    CatalogSnapshotChanged,
    CatalogUnavailable,
    retrieve_candidates,
)
from torob.recommend.models import RetrievalPolicy


def test_retrieval_is_bounded_and_discloses_price_prefix(
    offer_factory, source_factory, criteria_factory
):
    source = source_factory(
        [offer_factory(f"mock-{index}", price_toman=index + 1) for index in range(8)]
    )
    batch = retrieve_candidates(
        source, criteria_factory(), RetrievalPolicy(max_pages=2, page_size=3)
    )
    assert len(source.calls) == 2
    assert [query.page for query in source.calls] == [1, 2]
    assert len(batch.candidates) == 6
    assert batch.coverage.catalog_total == 8
    assert batch.coverage.complete_for_query is False
    assert batch.coverage.stop_reason == "page_limit"
    assert batch.coverage.full_dataset_ranking is False
    assert batch.context == source.context


def test_retrieval_stops_at_exhaustion_without_extra_request(
    offer_factory, source_factory, criteria_factory
):
    source = source_factory([offer_factory("mock-1"), offer_factory("mock-2")])
    batch = retrieve_candidates(source, criteria_factory(), RetrievalPolicy(page_size=1))
    assert len(source.calls) == 2
    assert batch.coverage.complete_for_query is True
    assert batch.coverage.pages_fetched == 2


def test_query_uses_exact_budget_unit_conversion_and_user_location(
    source_factory, criteria_factory
):
    source = source_factory([])
    criteria = criteria_factory(
        max_budget="250000009.9",
        price_unit="IRR",
        latitude=35.7,
        longitude=51.4,
        max_distance_km=5,
    )
    retrieve_candidates(source, criteria, RetrievalPolicy(page_size=7))
    query = source.calls[0]
    assert query.q == criteria.query
    assert query.max_price_toman == 25000000
    assert (query.lat, query.lon, query.radius_km) == (35.7, 51.4, 5)
    assert query.sort == "price_asc" and query.page_size == 7


def test_empty_catalog_keeps_unknown_dataset_explicit(
    source_factory, empty_context, criteria_factory
):
    source = source_factory([], context=empty_context)
    batch = retrieve_candidates(source, criteria_factory())
    assert batch.candidates == []
    assert batch.context.dataset is None
    assert batch.coverage.complete_for_query is True
    assert len(source.calls) == 1


def test_actual_catalog_repository_and_api_are_compatible(db_path, api_source, criteria_factory):
    criteria = criteria_factory(query="گوشی", max_budget="50000000")
    repository_batch = retrieve_candidates(
        CatalogRepository(db_path), criteria, RetrievalPolicy(page_size=1, max_pages=5)
    )
    api_batch = retrieve_candidates(api_source, criteria, RetrievalPolicy(page_size=1, max_pages=5))
    assert api_batch == repository_batch
    assert len(api_batch.candidates) == 3  # Unknown-price offer excluded by actual Catalog query.
    assert api_batch.context.dataset.source_kind == "sample"
    assert all(item.availability == "unconfirmed" for item in api_batch.candidates)


@pytest.mark.parametrize("field", ["dataset_id", "notices"])
def test_mixed_snapshots_are_rejected_not_returned_as_partial_success(
    field, offer_factory, source_factory, criteria_factory
):
    source = source_factory([offer_factory("mock-1"), offer_factory("mock-2")])
    original = source.search

    def changing(query):
        page = original(query)
        if query.page == 2:
            data = page.model_dump()
            if field == "dataset_id":
                data["context"]["dataset"]["dataset_id"] = "mock-new-snapshot"
            else:
                data["context"]["notices"].append("mock-changed-context")
            return CatalogPage.model_validate(data)
        return page

    source.search = changing
    with pytest.raises(CatalogSnapshotChanged) as caught:
        retrieve_candidates(source, criteria_factory(), RetrievalPolicy(page_size=1))
    assert caught.value.retryable is True
    assert len(source.calls) == 2


@pytest.mark.parametrize(
    "update",
    [
        {"page": 2},
        {"page_size": 99},
        {"total": -1},
        {"has_next": True},
        {"items": []},
        {"context": {"contract_version": "unknown-version"}},
        {"context": {"dataset": None}},
    ],
)
def test_malformed_page_metadata_fails_closed(
    update, offer_factory, source_factory, criteria_factory
):
    source = source_factory([offer_factory("mock-1")])
    original = source.search

    def corrupted(query):
        data = original(query).model_dump()
        if "context" in update:
            data["context"].update(update["context"])
        else:
            data.update(update)
        return CatalogPage.model_validate(data)

    source.search = corrupted
    with pytest.raises(CatalogRetrievalError):
        retrieve_candidates(source, criteria_factory())


def test_duplicate_offers_across_pages_rejected(offer_factory, source_factory, criteria_factory):
    source = source_factory([offer_factory("mock-1"), offer_factory("mock-2")])
    original = source.search

    def duplicate(query):
        page = original(query)
        if query.page == 2:
            return CatalogPage.model_validate(
                page.model_dump() | {"items": [source.items[0].model_dump()]}
            )
        return page

    source.search = duplicate
    with pytest.raises(CatalogRetrievalError, match="Duplicate"):
        retrieve_candidates(source, criteria_factory(), RetrievalPolicy(page_size=1))


def test_changed_total_is_rejected(offer_factory, source_factory, criteria_factory):
    source = source_factory([offer_factory("mock-1"), offer_factory("mock-2")])
    original = source.search

    def changed(query):
        page = original(query)
        return page if query.page == 1 else page.model_copy(update={"total": 3})

    source.search = changed
    with pytest.raises(CatalogRetrievalError, match="total changed"):
        retrieve_candidates(source, criteria_factory(), RetrievalPolicy(page_size=1))


def test_unsorted_price_prefix_rejected(offer_factory, source_factory, criteria_factory):
    source = source_factory(
        [offer_factory("mock-1", price_toman=1), offer_factory("mock-2", price_toman=2)]
    )
    source.items.reverse()
    with pytest.raises(CatalogRetrievalError, match="price_asc"):
        retrieve_candidates(source, criteria_factory())


@pytest.mark.parametrize("distance", [-1, float("inf"), float("nan")])
def test_invalid_catalog_distance_rejected(
    distance, offer_factory, source_factory, criteria_factory
):
    source = source_factory([offer_factory("mock-1", distance_km=distance)])
    with pytest.raises(CatalogRetrievalError, match="distance"):
        retrieve_candidates(source, criteria_factory())


def test_noncanonical_source_response_rejected(source_factory, criteria_factory):
    source = source_factory([])
    source.search = lambda _query: {"items": []}
    with pytest.raises(CatalogRetrievalError, match="canonical"):
        retrieve_candidates(source, criteria_factory())


def test_failure_on_later_page_does_not_return_earlier_page(
    offer_factory, source_factory, criteria_factory
):
    source = source_factory([offer_factory("mock-1"), offer_factory("mock-2")])
    original = source.search

    def failing(query):
        if query.page == 2:
            raise TimeoutError("private upstream diagnostic")
        return original(query)

    source.search = failing
    with pytest.raises(CatalogUnavailable):
        retrieve_candidates(source, criteria_factory(), RetrievalPolicy(page_size=1))


class FakeResponse:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error

    def raise_for_status(self):
        if self.error:
            raise self.error

    def json(self):
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload


class Transport:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def get(self, path, **kwargs):
        self.calls.append((path, kwargs))
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


def test_http_adapter_passes_fixed_route_parameters_and_timeout(canonical_page):
    transport = Transport(FakeResponse(canonical_page.model_dump(mode="json")))
    result = CatalogAPIClient(transport, timeout_seconds=2).search(CatalogQuery(q="گوشی"))
    assert result == canonical_page
    route, kwargs = transport.calls[0]
    assert route == "/api/v1/catalog/offers"
    assert kwargs["params"]["q"] == "گوشی"
    assert "lat" not in kwargs["params"]
    assert kwargs["timeout"] == 2


@pytest.mark.parametrize("value", [0, -1, True, "5", 31, float("inf")])
def test_http_timeout_is_bounded(value):
    with pytest.raises(ValueError):
        CatalogAPIClient(Transport(FakeResponse()), timeout_seconds=value)


@pytest.mark.parametrize(
    "response,exception",
    [
        (TimeoutError("timeout"), CatalogUnavailable),
        (FakeResponse(error=RuntimeError("HTTP 503")), CatalogUnavailable),
        (FakeResponse(payload=json.JSONDecodeError("bad JSON", "?", 0)), CatalogRetrievalError),
        (FakeResponse(payload={"items": "wrong shape"}), CatalogRetrievalError),
    ],
)
def test_http_errors_are_typed(response, exception):
    with pytest.raises(exception):
        CatalogAPIClient(Transport(response)).search(CatalogQuery())
