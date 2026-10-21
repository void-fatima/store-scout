"""SQL access only; recommendations and journey state belong to other modules."""

import json
from pathlib import Path

from torob.catalog.contracts import (
    CatalogContext,
    CatalogPage,
    CatalogQuery,
    DatasetInfo,
    OfferCandidate,
    OfferDetail,
    Product,
    ProductDetail,
    ProductSummary,
    Shop,
    ShopMatch,
    ShopPage,
    ShopQuery,
)
from torob.catalog.text import fts_query, normalize_text
from torob.data.database import connect


class CatalogRepository:
    def __init__(self, db_path: Path):
        self.db_path = db_path

    @staticmethod
    def _context(db) -> CatalogContext:
        row = db.execute("SELECT value FROM metadata WHERE key = 'dataset'").fetchone()
        return CatalogContext(dataset=DatasetInfo.model_validate_json(row[0]) if row else None)

    def context(self) -> CatalogContext:
        with connect(self.db_path, readonly=True) as db:
            return self._context(db)

    @staticmethod
    def _candidate(row):
        offer = json.loads(row["offer"])
        return OfferCandidate(
            offer_id=offer["offer_id"],
            product=ProductSummary.model_validate(
                {k: v for k, v in json.loads(row["product"]).items() if k != "specs"}
            ),
            shop=Shop.model_validate_json(row["shop"]),
            price_toman=offer["price_toman"],
            last_price_changed_at=offer["last_price_changed_at"],
            seller_title=offer["seller_title"],
            description=offer["description"],
            warranty=offer["warranty"],
            distance_km=round(row["distance"], 3) if row["distance"] is not None else None,
        )

    def search(self, query: CatalogQuery) -> CatalogPage:
        where, params = [], {"lat": query.lat, "lon": query.lon}
        if query.q:
            where.append(
                "o.product_id IN (SELECT product_id FROM product_search "
                "WHERE product_search MATCH :match)"
            )
            params["match"] = fts_query(query.q)
        for value, expression, key in (
            (
                query.category,
                "o.product_id IN (SELECT product_id FROM products "
                "WHERE category_normalized = :category)",
                "category",
            ),
            (query.shop_id, "o.shop_id = :shop_id", "shop_id"),
            (query.product_id, "o.product_id = :product_id", "product_id"),
            (query.min_price_toman, "o.price_toman >= :min_price", "min_price"),
            (query.max_price_toman, "o.price_toman <= :max_price", "max_price"),
            (
                query.radius_km,
                "o.shop_id IN (SELECT shop_id FROM shops "
                "WHERE distance_km(:lat, :lon, lat, lon) <= :radius)",
                "radius",
            ),
        ):
            if value is not None:
                where.append(expression)
                params[key] = normalize_text(value) if key == "category" else value
        base = "FROM offers o"
        if where:
            base += " WHERE " + " AND ".join(where)
        order = {
            "price_asc": "o.price_toman IS NULL ASC, o.price_toman ASC, o.offer_id ASC",
            "price_desc": "o.price_toman IS NULL ASC, o.price_toman DESC, o.offer_id ASC",
            "distance": "distance IS NULL ASC, distance ASC, o.price_toman ASC, o.offer_id ASC",
            "price_changed_desc": "o.last_price_changed_at DESC, o.offer_id ASC",
        }[query.sort]
        params.update(limit=query.page_size, offset=(query.page - 1) * query.page_size)
        with connect(self.db_path, readonly=True) as db:
            # Count, rows and metadata describe the same committed snapshot during reimport.
            db.execute("BEGIN")
            total = db.execute("SELECT COUNT(*) " + base, params).fetchone()[0]
            # Sort/page compact IDs first. Fetch large product specs/shop JSON only for
            # the requested page, rather than joining all 330k offers before sorting.
            if query.lat is None:
                distance = "NULL AS distance "
                page_base = base
            else:
                distance = "distance_km(:lat, :lon, s.lat, s.lon) AS distance "
                page_base = base.replace(
                    "FROM offers o", "FROM offers o JOIN shops s USING(shop_id)"
                )
            rows = db.execute(
                "WITH page AS MATERIALIZED ("
                "SELECT o.offer_id, o.price_toman, o.last_price_changed_at, "
                + distance
                + page_base
                + f" ORDER BY {order} LIMIT :limit OFFSET :offset) "
                "SELECT o.payload AS offer, p.payload AS product, s.payload AS shop, page.distance "
                "FROM page JOIN offers o USING(offer_id) "
                "JOIN products p ON p.product_id = o.product_id "
                "JOIN shops s ON s.shop_id = o.shop_id "
                f"ORDER BY {order.replace('o.', 'page.')}",
                params,
            ).fetchall()
            return CatalogPage(
                items=[self._candidate(row) for row in rows],
                total=total,
                page=query.page,
                page_size=query.page_size,
                has_next=query.page * query.page_size < total,
                context=self._context(db),
            )

    def offer(self, offer_id: str) -> OfferDetail | None:
        with connect(self.db_path, readonly=True) as db:
            db.execute("BEGIN")
            row = db.execute(
                "SELECT o.payload AS offer, p.payload AS product, s.payload AS shop, "
                "NULL AS distance FROM offers o JOIN products p USING(product_id) "
                "JOIN shops s USING(shop_id) WHERE o.offer_id = ?",
                (offer_id,),
            ).fetchone()
            return (
                OfferDetail(item=self._candidate(row), context=self._context(db)) if row else None
            )

    def product(self, product_id: str) -> ProductDetail | None:
        with connect(self.db_path, readonly=True) as db:
            db.execute("BEGIN")
            row = db.execute(
                "SELECT payload FROM products WHERE product_id = ?", (product_id,)
            ).fetchone()
            return (
                ProductDetail(item=Product.model_validate_json(row[0]), context=self._context(db))
                if row
                else None
            )

    def shops(self, query: ShopQuery) -> ShopPage:
        clauses, params = [], {"lat": query.lat, "lon": query.lon}
        if query.category is not None:
            clauses.append("s.shop_id IN (SELECT shop_id FROM shop_categories WHERE category = :c)")
            params["c"] = normalize_text(query.category)
        if query.radius_km is not None:
            clauses.append("distance_km(:lat, :lon, s.lat, s.lon) <= :radius")
            params["radius"] = query.radius_km
        base = "FROM shops s" + (" WHERE " + " AND ".join(clauses) if clauses else "")
        order = "distance IS NULL, distance, s.shop_id" if query.lat is not None else "s.shop_id"
        params.update(limit=query.page_size, offset=(query.page - 1) * query.page_size)
        with connect(self.db_path, readonly=True) as db:
            db.execute("BEGIN")
            total = db.execute("SELECT COUNT(*) " + base, params).fetchone()[0]
            rows = db.execute(
                "SELECT s.payload, distance_km(:lat, :lon, s.lat, s.lon) AS distance "
                + base
                + f" ORDER BY {order} LIMIT :limit OFFSET :offset",
                params,
            ).fetchall()
            return ShopPage(
                items=[
                    ShopMatch(
                        shop=Shop.model_validate_json(row["payload"]),
                        distance_km=round(row["distance"], 3)
                        if row["distance"] is not None
                        else None,
                    )
                    for row in rows
                ],
                total=total,
                page=query.page,
                page_size=query.page_size,
                has_next=query.page * query.page_size < total,
                context=self._context(db),
            )
