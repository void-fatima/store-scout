import csv
import shutil
import sqlite3
import zipfile

import pytest
from conftest import SAMPLE

from torob.catalog.contracts import CatalogQuery
from torob.catalog.repository import CatalogRepository
from torob.cli import main
from torob.data.importer import ImportFailure, import_dataset


def copy_source(tmp_path):
    source = tmp_path / "source"
    shutil.copytree(SAMPLE, source)
    return source


def edit_csv(source, table, edit):
    file = source / f"{table}.csv"
    with file.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        fields, rows = reader.fieldnames, list(reader)
    edit(rows)
    with file.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def test_import_preserves_nested_data_and_reports_quality(db_path):
    repo = CatalogRepository(db_path)
    assert repo.context().dataset.counts == {"shops": 4, "products": 4, "offers": 5}
    item = repo.search(CatalogQuery(shop_id="sample_shop_center")).items[0]
    assert item.shop.payment_options == ["پرداخت در محل"]
    assert item.shop.weekly_hours["sat"]["status"] == "declared"
    report = import_dataset(SAMPLE, db_path, replace=True, source_kind="sample")
    assert report.issue_counts == {
        "missing_coordinates": 1,
        "missing_price_timestamp": 1,
        "missing_price": 1,
        "duplicate_title": 1,
    }
    assert report.error_count == 0 and report.committed


def test_repeat_requires_explicit_replace_and_is_idempotent(db_path):
    with pytest.raises(ImportFailure):
        import_dataset(SAMPLE, db_path)
    for _ in range(2):
        import_dataset(SAMPLE, db_path, replace=True, source_kind="sample")
    assert CatalogRepository(db_path).search(CatalogQuery()).total == 5


@pytest.mark.parametrize(
    "bad_price", ["0", "-100", "1.5", "NaN", "invalid", "10000000000000000000"]
)
def test_bad_prices_never_replace_previous_snapshot(tmp_path, db_path, bad_price):
    source = copy_source(tmp_path)
    edit_csv(source, "offers", lambda rows: rows[0].update(price_toman=bad_price))
    original = CatalogRepository(db_path).context().dataset.dataset_id
    with pytest.raises(ImportFailure) as caught:
        import_dataset(source, db_path, replace=True)
    assert caught.value.report.counts["offers"].rejected == 1
    assert not caught.value.report.committed
    assert CatalogRepository(db_path).context().dataset.dataset_id == original
    assert CatalogRepository(db_path).search(CatalogQuery()).total == 5


def test_lenient_mode_skips_invalid_and_orphaned_rows(tmp_path):
    source = copy_source(tmp_path)
    edit_csv(source, "shops", lambda rows: rows[0].update(lat="999"))
    target = tmp_path / "valid-only.sqlite3"
    report = import_dataset(source, target, allow_invalid=True, source_kind="sample")
    assert report.committed
    assert report.counts["shops"].rejected == 1
    assert report.counts["offers"].rejected == 3
    assert report.issue_counts["missing_reference"] == 3
    assert CatalogRepository(target).search(CatalogQuery()).total == 2


def test_duplicate_ids_and_invalid_json_are_reported(tmp_path):
    source = copy_source(tmp_path)
    edit_csv(source, "shops", lambda rows: rows[0].update(weekly_hours="not-json"))
    edit_csv(source, "products", lambda rows: rows.append(rows[0]))
    with pytest.raises(ImportFailure) as caught:
        import_dataset(source, tmp_path / "bad.sqlite3")
    report = caught.value.report
    assert report.issue_counts["duplicate_id"] == 1
    assert report.issue_counts["invalid_row"] == 1
    assert report.issue_counts["missing_reference"] == 3


def test_missing_headers_fail_even_in_lenient_mode(tmp_path, db_path):
    source = copy_source(tmp_path)
    (source / "offers.csv").write_text("offer_id,price\nwrong,42\n", encoding="utf-8")
    with pytest.raises(ImportFailure):
        import_dataset(source, db_path, replace=True, allow_invalid=True)
    assert CatalogRepository(db_path).search(CatalogQuery()).total == 5


def test_dry_run_leaves_target_untouched(tmp_path, db_path):
    before = db_path.read_bytes()
    report = import_dataset(SAMPLE, db_path, dry_run=True, source_kind="sample")
    assert report.status == "dry_run" and not report.committed
    assert db_path.read_bytes() == before
    absent = tmp_path / "does-not-exist" / "test.sqlite3"
    import_dataset(SAMPLE, absent, dry_run=True, source_kind="sample")
    assert not absent.parent.exists()


def test_zip_input_ignores_macos_files_and_does_not_extract(tmp_path):
    archive = tmp_path / "data.zip"
    with zipfile.ZipFile(archive, "w") as z:
        for file in SAMPLE.glob("*.csv"):
            z.write(file, f"torob-dataset/{file.name}")
            z.writestr(f"__MACOSX/torob-dataset/._{file.name}", b"\x00\xff")
        z.writestr("../../unexpected.txt", "must never be extracted")
    target = tmp_path / "zipped.sqlite3"
    report = import_dataset(archive, target, source_kind="sample")
    assert report.counts["offers"].accepted == 5
    assert not (tmp_path / "torob-dataset").exists()


def test_ambiguous_archive_and_missing_files_are_rejected(tmp_path):
    archive = tmp_path / "ambiguous.zip"
    with zipfile.ZipFile(archive, "w") as z:
        for folder in ["one", "two"]:
            for file in SAMPLE.glob("*.csv"):
                z.write(file, f"{folder}/{file.name}")
    with pytest.raises(ImportFailure):
        import_dataset(archive, tmp_path / "bad.sqlite3")
    with pytest.raises(ImportFailure):
        import_dataset(tmp_path / "missing.zip", tmp_path / "bad.sqlite3")


@pytest.mark.parametrize("timestamp", ["2026-10-01", "2026-10-01T12:00:00", "wrong"])
def test_timestamps_require_explicit_timezone(tmp_path, timestamp):
    source = copy_source(tmp_path)
    edit_csv(source, "offers", lambda rows: rows[0].update(last_price_changed_at=timestamp))
    with pytest.raises(ImportFailure):
        import_dataset(source, tmp_path / "bad.sqlite3")


def test_readers_keep_previous_snapshot_until_import_commits(tmp_path, db_path):
    source = copy_source(tmp_path)
    edit_csv(source, "offers", lambda rows: rows[0].update(price_toman="10000000"))
    repo = CatalogRepository(db_path)
    observations = []

    def during_import(table, counts):
        observations.append(repo.offer("sample_offer_1").item.price_toman)

    import_dataset(source, db_path, replace=True, source_kind="sample", progress=during_import)
    assert observations and set(observations) == {20_000_000}
    assert repo.offer("sample_offer_1").item.price_toman == 10_000_000


def test_unexpected_index_failure_rolls_back_entire_snapshot(tmp_path, db_path, monkeypatch):
    from torob.data import importer

    original_insert = importer.insert_row

    def index_failure(db, table, record):
        original_insert(db, table, record)
        if table == "products":
            raise sqlite3.IntegrityError("simulated child/index failure")

    original_id = CatalogRepository(db_path).context().dataset.dataset_id
    monkeypatch.setattr(importer, "insert_row", index_failure)
    with pytest.raises(ImportFailure):
        import_dataset(SAMPLE, db_path, replace=True, allow_invalid=True, source_kind="sample")
    assert CatalogRepository(db_path).context().dataset.dataset_id == original_id
    assert CatalogRepository(db_path).search(CatalogQuery()).total == 5


def test_cli_reports_failure_with_nonzero_exit(tmp_path):
    report = tmp_path / "report.json"
    status = main(
        [
            "import-data",
            str(tmp_path / "missing.zip"),
            "--db",
            str(tmp_path / "missing.sqlite3"),
            "--report",
            str(report),
        ]
    )
    assert status == 1
    assert '"status": "rejected"' in report.read_text(encoding="utf-8")
