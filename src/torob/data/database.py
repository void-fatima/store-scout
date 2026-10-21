import sqlite3
from contextlib import contextmanager
from pathlib import Path

from torob.catalog.contracts import distance_km

SCHEMA_VERSION = 1
SCHEMA = """
CREATE TABLE IF NOT EXISTS shops (
    shop_id TEXT PRIMARY KEY, lat REAL, lon REAL, payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shops_lat_lon ON shops(lat, lon);
CREATE TABLE IF NOT EXISTS shop_categories (
    shop_id TEXT NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    category TEXT NOT NULL, PRIMARY KEY (category, shop_id)
);
CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY, title_normalized TEXT NOT NULL,
    category_normalized TEXT NOT NULL, payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS products_category ON products(category_normalized);
CREATE INDEX IF NOT EXISTS products_title ON products(title_normalized);
CREATE VIRTUAL TABLE IF NOT EXISTS product_search USING fts5(
    product_id UNINDEXED, title, brand, model, category,
    tokenize='unicode61', prefix='2 3 4'
);
CREATE TABLE IF NOT EXISTS offers (
    offer_id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(product_id),
    shop_id TEXT NOT NULL REFERENCES shops(shop_id),
    price_toman INTEGER CHECK(price_toman > 0),
    last_price_changed_at TEXT, payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS offers_product_price ON offers(product_id, price_toman, offer_id);
CREATE INDEX IF NOT EXISTS offers_shop_price ON offers(shop_id, price_toman, offer_id);
CREATE INDEX IF NOT EXISTS offers_price ON offers(price_toman, offer_id);
CREATE INDEX IF NOT EXISTS offers_price_asc ON offers(
    (price_toman IS NULL), price_toman, offer_id
);
CREATE INDEX IF NOT EXISTS offers_price_desc ON offers(
    (price_toman IS NULL), price_toman DESC, offer_id
);
CREATE INDEX IF NOT EXISTS offers_changed ON offers(last_price_changed_at, offer_id);
CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


@contextmanager
def connect(path: Path, *, readonly: bool = False):
    if readonly:
        connection = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=30)
    else:
        connection = sqlite3.connect(path, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.create_function("distance_km", 4, distance_km, deterministic=True)
    try:
        yield connection
    finally:
        connection.close()


def initialize(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        version = db.execute("PRAGMA user_version").fetchone()[0]
        if version not in (0, SCHEMA_VERSION):
            raise RuntimeError(f"Unsupported database schema {version}; expected {SCHEMA_VERSION}")
        db.execute("PRAGMA journal_mode = WAL")
        db.executescript(SCHEMA)
        db.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        db.commit()
