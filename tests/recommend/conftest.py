"""MOCK-only factories for recommendation behavior tests."""

from copy import deepcopy
from pathlib import Path

import pytest

from torob.catalog.contracts import CatalogContext, CatalogPage, CatalogQuery, OfferCandidate
from torob.recommend.models import CandidateBatch, CandidateCoverage, ShoppingCriteria

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def canonical_page():
    return CatalogPage.model_validate_json(
        (ROOT / "contracts/examples/catalog-page.json").read_text(encoding="utf-8")
    )


@pytest.fixture
def offer_factory(canonical_page):
    def make(offer_id, **updates):
        data = canonical_page.items[0].model_dump()
        data["offer_id"] = offer_id
        data["product"].update(
            product_id=f"mock-product-{offer_id}",
            persian_title="گوشی سامسونگ Galaxy A55 256",
            category_name="گوشی موبایل",
            brand_name="سامسونگ",
            model="Galaxy A55",
        )
        data["shop"].update(shop_id=f"mock-shop-{offer_id}", lat=35.7, lon=51.4)
        for key, value in updates.items():
            if key in {"persian_title", "category_name", "brand_name", "model"}:
                data["product"][key] = value
            elif key in {"lat", "lon", "weekly_hours", "payment_options", "category_names"}:
                data["shop"][key] = value
            else:
                data[key] = value
        return OfferCandidate.model_validate(data)

    return make


@pytest.fixture
def criteria_factory():
    def make(**updates):
        return ShoppingCriteria.model_validate(
            {
                "query": "گوشی سامسونگ Galaxy A55",
                "max_budget": "25000000",
                "price_unit": "TOMAN",
            }
            | updates
        )

    return make


@pytest.fixture
def batch_factory(canonical_page):
    def make(items, *, total=None, page_size=100, context=None):
        total = len(items) if total is None else total
        pages = max(1, (len(items) + page_size - 1) // page_size)
        return CandidateBatch(
            candidates=items,
            context=context or canonical_page.context,
            coverage=CandidateCoverage(
                query=CatalogQuery(page_size=page_size),
                pages_fetched=pages,
                retrieved_count=len(items),
                catalog_total=total,
                complete_for_query=len(items) == total,
                stop_reason="exhausted" if len(items) == total else "page_limit",
            ),
        )

    return make


class MemorySource:
    """A literal paged test source; production filter integration uses the real API."""

    def __init__(self, items, context):
        self.items = sorted(
            items, key=lambda item: (item.price_toman is None, item.price_toman or 0, item.offer_id)
        )
        self.context = context
        self.calls = []

    def search(self, query):
        self.calls.append(CatalogQuery.model_validate(query.model_dump()))
        start = (query.page - 1) * query.page_size
        return CatalogPage(
            items=self.items[start : start + query.page_size],
            total=len(self.items),
            page=query.page,
            page_size=query.page_size,
            has_next=start + query.page_size < len(self.items),
            context=self.context,
        )


@pytest.fixture
def source_factory(canonical_page):
    def make(items, *, context=None):
        return MemorySource(items, deepcopy(context or canonical_page.context))

    return make


@pytest.fixture
def empty_context():
    return CatalogContext()


@pytest.fixture
def api_source(client):
    from torob.recommend.catalog import CatalogAPIClient

    class InProcessTransport:
        def get(self, path, *, params, timeout):
            # TestClient runs in-process, so it has no network timeout. Keep the
            # production adapter's timeout protocol without its deprecated arg.
            return client.get(path, params=params)

    return CatalogAPIClient(InProcessTransport())
