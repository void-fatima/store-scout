import pytest
from fastapi.testclient import TestClient

from torob.api import create_app
from torob.catalog.contracts import CatalogPage, CatalogQuery, ShopPage, distance_km
from torob.catalog.repository import CatalogRepository
from torob.config import Settings

OFFERS = "/api/v1/catalog/offers"


def test_search_contract_and_source_provenance(client):
    response = client.get(OFFERS, params={"q": "گوشی"})
    assert response.status_code == 200
    page = CatalogPage.model_validate(response.json())
    assert page.total == 4
    assert page.context.dataset.source_kind == "sample"
    assert page.context.currency == "toman"
    assert "contact_numbers_synthetic" in page.context.notices
    assert all(item.availability == "unconfirmed" for item in page.items)
    assert all(item.evidence == "offer_record" for item in page.items)
    assert all(item.shop.contacts_status == "synthetic" for item in page.items)


@pytest.mark.parametrize(
    "query,total",
    [
        ("گوشي سامسونگ 256", 4),
        ("Galaxy A55 ۲۵۶", 4),
        ("كتري", 1),
        ("کَتـری", 1),
        ("گوشی‌سامسونگ", 4),
        ("Galaxy A55 ٢٥٦", 4),
        ("ناموجود", 0),
        ("لپ تاپ", 0),
        ("' OR 1=1 --", 0),
    ],
)
def test_persian_search_and_safe_fts(client, query, total):
    result = client.get(OFFERS, params={"q": query})
    assert result.status_code == 200
    assert result.json()["total"] == total


def test_filters_compose_and_boundaries_are_inclusive(client):
    response = client.get(
        OFFERS,
        params={
            "q": "گوشی",
            "shop_id": "sample_shop_center",
            "category": "گوشي موبایل",
            "min_price_toman": 20_000_000,
            "max_price_toman": 20_000_000,
        },
    ).json()
    assert response["total"] == 2
    assert {i["product"]["product_id"] for i in response["items"]} == {
        "sample_product_phone",
        "sample_product_same_title",
    }


def test_stable_pagination_no_duplicate_or_skipped_ties(client):
    pages = [client.get(OFFERS, params={"page": p, "page_size": 2}).json() for p in (1, 2, 3)]
    ids = [item["offer_id"] for page in pages for item in page["items"]]
    assert ids == [
        "sample_offer_5",
        "sample_offer_2",
        "sample_offer_1",
        "sample_offer_3",
        "sample_offer_4",
    ]
    assert [page["has_next"] for page in pages] == [True, True, False]
    assert all(page["total"] == 5 for page in pages)
    empty = client.get(OFFERS, params={"page": 9, "page_size": 2}).json()
    assert empty["items"] == [] and empty["total"] == 5


def test_geo_excludes_unknown_and_far_shops(client):
    page = client.get(
        OFFERS,
        params={
            "q": "گوشی",
            "lat": 35.7,
            "lon": 51.4,
            "radius_km": 1,
            "sort": "distance",
        },
    ).json()
    assert page["total"] == 2
    assert all(i["shop"]["shop_id"] == "sample_shop_center" for i in page["items"])
    assert all(i["distance_km"] == 0 for i in page["items"])


def test_unknown_distance_is_null_and_last(client):
    page = client.get(OFFERS, params={"lat": 35.7, "lon": 51.4, "sort": "distance"}).json()
    assert page["total"] == 5
    assert page["items"][-1]["shop"]["shop_id"] == "sample_shop_no_geo"
    assert page["items"][-1]["distance_km"] is None
    assert distance_km(0, 0, 0, 1) == pytest.approx(111.195, abs=0.001)


def test_unknown_price_is_retained_but_never_satisfies_a_budget(client):
    all_items = client.get(OFFERS, params={"q": "گوشی"}).json()
    assert all_items["items"][-1]["price_toman"] is None
    for sort in ("price_asc", "price_desc"):
        page = client.get(OFFERS, params={"sort": sort}).json()
        assert page["items"][-1]["offer_id"] == "sample_offer_4"
    priced = client.get(OFFERS, params={"q": "گوشی", "max_price_toman": 50_000_000}).json()
    assert priced["total"] == 3
    assert all(item["price_toman"] is not None for item in priced["items"])


def test_radius_uses_full_precision_before_display_rounding(client):
    distance = distance_km(35.7, 51.4, 35.8, 51.5)
    params = {"shop_id": "sample_shop_far", "lat": 35.7, "lon": 51.4}
    outside = client.get(OFFERS, params={**params, "radius_km": distance - 0.00001})
    inside = client.get(OFFERS, params={**params, "radius_km": distance + 0.00001})
    assert outside.json()["total"] == 0
    assert inside.json()["total"] == 1


def test_shop_category_never_becomes_product_offer(client):
    directory = client.get("/api/v1/catalog/shops", params={"category": "لپ تاپ"}).json()
    ShopPage.model_validate(directory)
    assert directory["total"] == 4
    assert all(i["evidence"] == "shop_record_only" for i in directory["items"])
    assert all(i["product_availability"] == "not_established" for i in directory["items"])
    assert client.get(OFFERS, params={"q": "لپ تاپ"}).json()["items"] == []
    assert client.get(OFFERS, params={"shop_id": "sample_shop_category_only"}).json()["total"] == 0


@pytest.mark.parametrize(
    "params",
    [
        {"lat": 35},
        {"lon": 51},
        {"radius_km": 2},
        {"sort": "distance"},
        {"lat": 91, "lon": 51},
        {"lat": "nan", "lon": 51},
        {"lat": 35, "lon": "inf"},
        {"page": 0},
        {"page_size": 101},
        {"min_price_toman": -1},
        {"min_price_toman": 20, "max_price_toman": 10},
        {"q": "***"},
        {"category": "   "},
        {"sort": "DROP TABLE"},
        {"unknown_filter": "x"},
    ],
)
def test_bad_filters_have_structured_errors(client, params):
    response = client.get(OFFERS, params=params)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_query"


def test_price_change_sort_null_and_timezone(client):
    page = client.get(OFFERS, params={"sort": "price_changed_desc"}).json()
    assert page["items"][0]["offer_id"] == "sample_offer_3"
    assert page["items"][-1]["last_price_changed_at"] is None
    one = next(i for i in page["items"] if i["offer_id"] == "sample_offer_1")
    assert one["last_price_changed_at"] == "2026-09-14T06:30:00Z"


def test_details_and_not_found(client):
    product = client.get("/api/v1/catalog/products/sample_product_phone").json()
    assert product["item"]["specs"][0]["value"] == "ساختگی"
    assert product["context"]["dataset"]["source_kind"] == "sample"
    offer = client.get(OFFERS + "/sample_offer_1").json()
    assert offer["item"]["price_toman"] == 20_000_000
    assert offer["context"]["dataset"]["source_kind"] == "sample"
    for endpoint in [OFFERS + "/missing", "/api/v1/catalog/products/missing", "/missing"]:
        response = client.get(endpoint)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"


def test_empty_db_is_explicit_and_does_not_seed_data(tmp_path):
    with TestClient(create_app(Settings(db_path=tmp_path / "empty.sqlite3"))) as client:
        assert client.get("/health").json()["data_ready"] is False
        page = client.get(OFFERS).json()
        assert page["items"] == []
        assert page["context"]["dataset"] is None


def test_local_cors_and_repository_integration(client, db_path):
    allowed = client.get(OFFERS, headers={"Origin": "http://localhost:5173"})
    denied = client.get(OFFERS, headers={"Origin": "https://unrelated.example"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in denied.headers
    assert CatalogRepository(db_path).search(CatalogQuery(q="گوشی")).total == 4
