"""Regenerate the deliberately fictional, small integration fixture."""

import csv
import json
from pathlib import Path

from torob.data.importer import COLUMNS

ROOT = Path(__file__).resolve().parents[1]


def write_csv(path, table, rows):
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=sorted(COLUMNS[table]), lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    key: json.dumps(value, ensure_ascii=False, separators=(",", ":"))
                    if isinstance(value, (dict, list, bool)) or value is None
                    else value
                    for key, value in row.items()
                }
            )


def main():
    target = ROOT / "datasets" / "sample"
    target.mkdir(parents=True, exist_ok=True)
    shops = []
    for shop_id, name, lat, lon in [
        ("sample_shop_center", "فروشگاه نمونه مرکز", 35.7, 51.4),
        ("sample_shop_far", "فروشگاه نمونه دور", 35.8, 51.5),
        ("sample_shop_no_geo", "فروشگاه نمونه بدون مختصات", None, None),
        ("sample_shop_category_only", "فروشگاه نمونه فقط دسته", 35.7002, 51.4002),
    ]:
        shops.append(
            {
                "shop_id": shop_id,
                "name": name,
                "lat": lat,
                "lon": lon,
                "address": "نشانی ساختگی برای تست",
                "location_label": "محدوده نمونه تهران",
                "category_names": ["گوشی موبایل", "لپ تاپ"],
                "contacts": [],
                "instagram": None,
                "website_url": None,
                "supports_fast_delivery": None,
                "payment_options": ["پرداخت در محل"],
                "weekly_hours": {
                    "sat": {
                        "status": "declared",
                        "shifts": [{"start_time": "09:00:00", "end_time": "18:00:00"}],
                    }
                },
            }
        )
    products = []
    for product_id, title, category, brand in [
        ("sample_product_phone", "گوشی سامسونگ Galaxy A55 ۲۵۶", "گوشی موبایل", "سامسونگ"),
        ("sample_product_same_title", "گوشی سامسونگ Galaxy A55 ۲۵۶", "گوشی موبایل", "سامسونگ"),
        ("sample_product_kettle", "کتری برقی نمونه", "لوازم خانگی", None),
        ("sample_product_no_offer", "لپ تاپ لنوو نمونه", "لپ تاپ", "لنوو"),
    ]:
        products.append(
            {
                "product_id": product_id,
                "persian_title": title,
                "category_name": category,
                "brand_name": brand,
                "model": None,
                "image_urls": [],
                "specs": [{"section": "نمونه", "key": "داده", "value": "ساختگی"}],
            }
        )
    offers = []
    for offer_id, product_id, shop_id, price, stamp in [
        (
            "sample_offer_1",
            "sample_product_phone",
            "sample_shop_center",
            20_000_000,
            "2026-09-14T10:00:00+03:30",
        ),
        (
            "sample_offer_2",
            "sample_product_phone",
            "sample_shop_far",
            19_000_000,
            "2026-09-15T10:00:00+00:00",
        ),
        (
            "sample_offer_3",
            "sample_product_same_title",
            "sample_shop_center",
            20_000_000,
            "2026-09-16T10:00:00+00:00",
        ),
        ("sample_offer_4", "sample_product_phone", "sample_shop_no_geo", None, None),
        (
            "sample_offer_5",
            "sample_product_kettle",
            "sample_shop_center",
            1_500_000,
            "2026-09-14T10:00:00+00:00",
        ),
    ]:
        offers.append(
            {
                "offer_id": offer_id,
                "product_id": product_id,
                "shop_id": shop_id,
                "price_toman": price,
                "last_price_changed_at": stamp,
                "seller_title": "عنوان نمونه فروشنده",
                "description": None,
                "warranty": None,
            }
        )
    for table, rows in [("shops", shops), ("products", products), ("offers", offers)]:
        write_csv(target / f"{table}.csv", table, rows)


if __name__ == "__main__":
    main()
