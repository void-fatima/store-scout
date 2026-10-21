"""Exercise a running catalog API against its currently imported dataset."""

import argparse
import json
import time
from pathlib import Path

import httpx

from torob.catalog.contracts import CatalogPage, OfferDetail, ProductDetail, ShopPage


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--report", type=Path, default=Path("var/reports/latest-smoke.json"))
    args = parser.parse_args()
    checks = []
    with httpx.Client(base_url=args.base_url, timeout=30) as client:

        def get(path, params=None, expected=200):
            started = time.perf_counter()
            response = client.get(path, params=params)
            assert response.status_code == expected, (
                path,
                response.status_code,
                response.text[:500],
            )
            checks.append(
                {
                    "path": path,
                    "params": params,
                    "status": response.status_code,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
                }
            )
            return response

        assert get("/health").json()["data_ready"] is True
        get("/docs")
        get("/openapi.json")
        first = CatalogPage.model_validate(get("/api/v1/catalog/offers").json())
        assert first.total > 0 and first.context.dataset is not None
        item = first.items[0]
        detail = OfferDetail.model_validate(get(f"/api/v1/catalog/offers/{item.offer_id}").json())
        assert detail.item == item
        product = ProductDetail.model_validate(
            get(f"/api/v1/catalog/products/{item.product.product_id}").json()
        )
        assert product.item.product_id == item.product.product_id
        budget = CatalogPage.model_validate(
            get(
                "/api/v1/catalog/offers",
                {
                    "q": "گوشی",
                    "max_price_toman": 25_000_000,
                },
            ).json()
        )
        assert all(i.price_toman is not None and i.price_toman <= 25_000_000 for i in budget.items)
        geo = CatalogPage.model_validate(
            get(
                "/api/v1/catalog/offers",
                {
                    "lat": 35.7,
                    "lon": 51.4,
                    "radius_km": 5,
                    "sort": "distance",
                },
            ).json()
        )
        assert all(i.distance_km is not None and i.distance_km <= 5.001 for i in geo.items)
        shops = ShopPage.model_validate(
            get("/api/v1/catalog/shops", {"category": "گوشی موبایل"}).json()
        )
        assert all(i.product_availability == "not_established" for i in shops.items)
        invalid = get("/api/v1/catalog/offers", {"lat": 35}, expected=422).json()
        assert invalid["error"]["code"] == "invalid_query"
        get("/api/v1/catalog/offers/missing", expected=404)
    report = {
        "status": "passed",
        "dataset": first.context.dataset.model_dump(mode="json"),
        "checks": checks,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"{len(checks)} HTTP checks passed; report: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
