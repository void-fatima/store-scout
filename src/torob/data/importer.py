"""Stream the supplied Torob ZIP or three CSVs into an atomic SQLite snapshot."""

import csv
import hashlib
import io
import json
import sqlite3
import tempfile
import zipfile
from collections.abc import Callable
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from torob.catalog.contracts import DatasetInfo, Offer, Product, Shop
from torob.catalog.text import normalize_text
from torob.data.database import connect, initialize

COLUMNS = {
    "shops": {
        "address",
        "category_names",
        "contacts",
        "instagram",
        "lat",
        "location_label",
        "lon",
        "name",
        "payment_options",
        "shop_id",
        "supports_fast_delivery",
        "website_url",
        "weekly_hours",
    },
    "products": {
        "brand_name",
        "category_name",
        "image_urls",
        "model",
        "persian_title",
        "product_id",
        "specs",
    },
    "offers": {
        "description",
        "last_price_changed_at",
        "offer_id",
        "price_toman",
        "product_id",
        "seller_title",
        "shop_id",
        "warranty",
    },
}


class RowCount(BaseModel):
    read: int = 0
    accepted: int = 0
    rejected: int = 0


class Issue(BaseModel):
    severity: Literal["error", "warning"]
    table: str
    row: int | None
    code: str
    message: str


class ImportReport(BaseModel):
    status: Literal["validating", "imported", "dry_run", "rejected"] = "validating"
    committed: bool = False
    source_kind: Literal["sample", "provided"]
    source_sha256: str | None = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = None
    counts: dict[str, RowCount] = Field(
        default_factory=lambda: {name: RowCount() for name in COLUMNS}
    )
    error_count: int = 0
    warning_count: int = 0
    issue_counts: dict[str, int] = Field(default_factory=dict)
    issues: list[Issue] = Field(default_factory=list)
    issues_truncated: bool = False

    def issue(self, severity, table, row, code, message, *, count=1):
        if severity == "error":
            self.error_count += count
        else:
            self.warning_count += count
        self.issue_counts[code] = self.issue_counts.get(code, 0) + count
        # Reserve independent samples so many early warnings cannot hide later errors.
        if sum(item.severity == severity for item in self.issues) < 100:
            self.issues.append(
                Issue(severity=severity, table=table, row=row, code=code, message=message)
            )
        else:
            self.issues_truncated = True


class ImportFailure(Exception):
    def __init__(self, report: ImportReport):
        self.report = report
        super().__init__("Dataset import rejected; see the quality report")


class RowRejected(ValueError):
    """An expected primary-row constraint failure, before any child/index inserts."""

    def __init__(self, error: sqlite3.IntegrityError):
        self.code = "missing_reference" if "FOREIGN KEY" in str(error) else "duplicate_id"
        super().__init__(str(error))


def insert_primary(db, sql, parameters):
    try:
        db.execute(sql, parameters)
    except sqlite3.IntegrityError as error:
        raise RowRejected(error) from error


class Source:
    def __init__(self, path: Path):
        self.path = path
        self.archive = None
        self.members = {}

    def __enter__(self):
        if self.path.is_dir():
            for table in COLUMNS:
                if not (self.path / f"{table}.csv").is_file():
                    raise ValueError(f"Missing {table}.csv")
        else:
            self.archive = zipfile.ZipFile(self.path)
            try:
                for table in COLUMNS:
                    candidates = [
                        info.filename
                        for info in self.archive.infolist()
                        if not info.is_dir()
                        and "__MACOSX" not in info.filename.split("/")
                        and info.filename.split("/")[-1] == f"{table}.csv"
                    ]
                    if len(candidates) != 1:
                        raise ValueError(f"ZIP must contain exactly one {table}.csv")
                    self.members[table] = candidates[0]
                parents = {name.rpartition("/")[0] for name in self.members.values()}
                if len(parents) != 1:
                    raise ValueError("The three CSVs must be in the same ZIP directory")
            except Exception:
                self.archive.close()
                raise
        return self

    def __exit__(self, *_):
        if self.archive:
            self.archive.close()

    @contextmanager
    def open(self, table):
        # No ZIP extraction: paths in the archive can never write outside the workspace.
        if self.archive:
            with self.archive.open(self.members[table]) as raw:
                with io.TextIOWrapper(raw, encoding="utf-8-sig", newline="") as stream:
                    yield stream
        else:
            with (self.path / f"{table}.csv").open(encoding="utf-8-sig", newline="") as stream:
                yield stream

    def fingerprint(self):
        digest = hashlib.sha256()
        paths = [self.path] if self.archive else [self.path / f"{t}.csv" for t in COLUMNS]
        for path in paths:
            if not self.archive:
                digest.update(path.name.encode())
            with path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(chunk)
        return digest.hexdigest()


def nullable(value: str | None):
    if value is None:
        return None
    value = value.strip()
    return None if value == "" or value.lower() == "null" else value


def json_value(value, default):
    value = nullable(value)
    return default if value is None else json.loads(value)


def parse_row(table: str, row: dict[str, str]):
    data = {key: nullable(value) for key, value in row.items()}
    if table == "shops":
        for key in ("category_names", "contacts", "payment_options"):
            data[key] = json_value(row[key], [])
        data["weekly_hours"] = json_value(row["weekly_hours"], {})
        flag = data["supports_fast_delivery"]
        if flag not in (None, "true", "false"):
            raise ValueError("supports_fast_delivery must be true, false or null")
        data["supports_fast_delivery"] = None if flag is None else flag == "true"
        return Shop.model_validate(data)
    if table == "products":
        data["image_urls"] = json_value(row["image_urls"], [])
        data["specs"] = json_value(row["specs"], [])
        product = Product.model_validate(data)
        if not normalize_text(product.persian_title):
            raise ValueError("persian_title must contain letters or digits")
        return product
    price = data["price_toman"]
    if price is not None and not price.isdecimal():
        raise ValueError("price_toman must be a positive integer in toman")
    data["price_toman"] = int(price) if price is not None else None
    stamp = data["last_price_changed_at"]
    if stamp is not None:
        if "T" not in stamp and " " not in stamp:
            raise ValueError("last_price_changed_at must be an ISO datetime with timezone")
        parsed = datetime.fromisoformat(stamp)
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError("last_price_changed_at must have a timezone")
        data["last_price_changed_at"] = parsed.astimezone(UTC)
    return Offer.model_validate(data)


def insert_row(db, table, record):
    payload = record.model_dump_json()
    if table == "shops":
        insert_primary(
            db,
            "INSERT INTO shops VALUES (?, ?, ?, ?)",
            (record.shop_id, record.lat, record.lon, payload),
        )
        db.executemany(
            "INSERT INTO shop_categories VALUES (?, ?)",
            [
                (record.shop_id, category)
                for category in sorted({normalize_text(c) for c in record.category_names})
                if category
            ],
        )
    elif table == "products":
        insert_primary(
            db,
            "INSERT INTO products VALUES (?, ?, ?, ?)",
            (
                record.product_id,
                normalize_text(record.persian_title),
                normalize_text(record.category_name or ""),
                payload,
            ),
        )
        db.execute(
            "INSERT INTO product_search VALUES (?, ?, ?, ?, ?)",
            (
                record.product_id,
                normalize_text(record.persian_title),
                normalize_text(record.brand_name or ""),
                normalize_text(record.model or ""),
                normalize_text(record.category_name or ""),
            ),
        )
    else:
        insert_primary(
            db,
            "INSERT INTO offers VALUES (?, ?, ?, ?, ?, ?)",
            (
                record.offer_id,
                record.product_id,
                record.shop_id,
                record.price_toman,
                record.last_price_changed_at.isoformat() if record.last_price_changed_at else None,
                payload,
            ),
        )


def load_tables(db, source, report, progress=None):
    csv.field_size_limit(10 * 1024 * 1024)
    for table, expected in COLUMNS.items():
        if progress:
            progress(table, report.counts[table])
        with source.open(table) as stream:
            reader = csv.DictReader(stream, strict=True)
            actual = reader.fieldnames or []
            if set(actual) != expected or len(actual) != len(expected):
                missing = sorted(expected - set(actual))
                extra = sorted(set(actual) - expected)
                raise ValueError(f"{table}.csv header mismatch; missing={missing}; extra={extra}")
            for row in reader:
                counts = report.counts[table]
                counts.read += 1
                if progress and counts.read % 50_000 == 0:
                    progress(table, counts)
                line = reader.line_num
                try:
                    if None in row or any(value is None for value in row.values()):
                        raise ValueError("CSV row has a different number of cells than its header")
                    record = parse_row(table, row)
                    # Expected constraints fail on the primary INSERT, before child writes.
                    # Unexpected child/index failures abort the entire outer transaction.
                    # Per-row SAVEPOINTs force FTS5 to flush its index on every record.
                    insert_row(db, table, record)
                except ValueError as error:
                    counts.rejected += 1
                    if isinstance(error, ValidationError):
                        message = "; ".join(
                            f"{'.'.join(map(str, e['loc']))}: {e['msg']}"
                            for e in error.errors(include_input=False, include_url=False)
                        )
                    else:
                        message = str(error)
                    code = "invalid_row"
                    if isinstance(error, RowRejected):
                        code = error.code
                    report.issue("error", table, line, code, message)
                    continue
                counts.accepted += 1
                if table == "shops" and record.lat is None:
                    report.issue(
                        "warning",
                        table,
                        line,
                        "missing_coordinates",
                        "Kept for catalog search; excluded from radius searches",
                    )
                if table == "offers" and record.last_price_changed_at is None:
                    report.issue(
                        "warning",
                        table,
                        line,
                        "missing_price_timestamp",
                        "Price-change time is unknown",
                    )
                if table == "offers" and record.price_toman is None:
                    report.issue(
                        "warning",
                        table,
                        line,
                        "missing_price",
                        "Offer relation retained; price is unknown and budget filters exclude it",
                    )
        if report.counts[table].accepted == 0:
            raise ValueError(f"{table}.csv has no valid records; refusing an empty snapshot")
        if progress:
            progress(table, report.counts[table])

    duplicates = (
        db.execute("""
        SELECT SUM(n - 1) FROM (
            SELECT COUNT(*) AS n FROM products GROUP BY title_normalized HAVING COUNT(*) > 1
        )
    """).fetchone()[0]
        or 0
    )
    if duplicates:
        report.issue(
            "warning",
            "products",
            None,
            "duplicate_title",
            "Distinct product IDs with the same normalized title are preserved",
            count=duplicates,
        )


def import_dataset(
    source_path: Path,
    db_path: Path,
    *,
    replace=False,
    allow_invalid=False,
    dry_run=False,
    source_kind: Literal["sample", "provided"] = "provided",
    progress: Callable[[str, RowCount], None] | None = None,
) -> ImportReport:
    report = ImportReport(source_kind=source_kind)
    # A dry run uses the same database constraints and importer without touching the target.
    with tempfile.TemporaryDirectory(prefix="store-scout-validate-") as temporary:
        target = Path(temporary) / "validate.sqlite3" if dry_run else db_path
        try:
            with Source(source_path) as source:
                initialize(target)
                with connect(target) as db:
                    db.execute("BEGIN IMMEDIATE")
                    try:
                        populated = db.execute("SELECT COUNT(*) FROM offers").fetchone()[0]
                        if populated and not replace:
                            raise ValueError(
                                "Database already has offers; use --replace explicitly"
                            )
                        for table in (
                            "offers",
                            "product_search",
                            "shop_categories",
                            "products",
                            "shops",
                            "metadata",
                        ):
                            db.execute(f"DELETE FROM {table}")
                        load_tables(db, source, report, progress)
                        if report.error_count and not allow_invalid:
                            raise ImportFailure(report)
                        report.source_sha256 = source.fingerprint()
                        info = DatasetInfo(
                            dataset_id=f"torob-{report.source_sha256[:16]}",
                            source_kind=source_kind,
                            imported_at=datetime.now(UTC),
                            source_sha256=report.source_sha256,
                            counts={name: count.accepted for name, count in report.counts.items()},
                        )
                        db.execute(
                            "INSERT INTO metadata VALUES ('dataset', ?)", (info.model_dump_json(),)
                        )
                        db.execute("INSERT INTO product_search(product_search) VALUES ('optimize')")
                        db.execute("ANALYZE")
                        db.commit()
                    except Exception:
                        db.rollback()
                        raise
                report.status = "dry_run" if dry_run else "imported"
                report.committed = not dry_run
        except (OSError, ValueError, csv.Error, zipfile.BadZipFile, sqlite3.Error) as error:
            report.issue("error", "dataset", None, "import_failed", str(error))
            report.status = "rejected"
            raise ImportFailure(report) from error
        except ImportFailure:
            report.status = "rejected"
            raise
        finally:
            report.completed_at = datetime.now(UTC)
    return report
