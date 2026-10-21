"""Export deterministic contracts/examples; --check detects accidental contract drift."""

import argparse
import json
import tempfile
from pathlib import Path

from torob.api import create_app
from torob.catalog.contracts import CatalogQuery, OfferCandidate, ShopQuery
from torob.catalog.repository import CatalogRepository
from torob.data.importer import import_dataset

ROOT = Path(__file__).resolve().parents[1]
QUERY = {
    "q": "گوشی",
    "max_price_toman": 25_000_000,
    "lat": 35.7,
    "lon": 51.4,
    "radius_km": 5,
    "sort": "distance",
    "page": 1,
    "page_size": 2,
}


def example(value):
    result = value.model_dump(mode="json")
    # Runtime import time is not part of the reproducible example fixture.
    result["context"]["dataset"]["imported_at"] = "2026-10-01T00:00:00Z"
    return result


def outputs():
    with tempfile.TemporaryDirectory(prefix="store-scout-contracts-") as directory:
        db = Path(directory) / "sample.sqlite3"
        import_dataset(ROOT / "datasets/sample", db, source_kind="sample")
        repo = CatalogRepository(db)
        return {
            "openapi.json": create_app().openapi(),
            "catalog-query.schema.json": CatalogQuery.model_json_schema(),
            "offer-candidate.schema.json": OfferCandidate.model_json_schema(),
            "examples/catalog-query.json": QUERY,
            "examples/catalog-page.json": example(repo.search(CatalogQuery(**QUERY))),
            "examples/shop-page.json": example(repo.shops(ShopQuery(category="لپ تاپ"))),
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    changed = []
    for name, value in outputs().items():
        text = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        file = ROOT / "contracts" / name
        if file.exists() and file.read_text(encoding="utf-8") == text:
            continue
        changed.append(name)
        if not args.check:
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text(text, encoding="utf-8", newline="\n")
    if args.check and changed:
        print("Contract drift: " + ", ".join(changed))
        print("Review the change with the team, then run this script without --check.")
        return 1
    print("Contracts match the implementation." if args.check else "Contracts exported.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
