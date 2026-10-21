import argparse
import os
from pathlib import Path

from torob.config import Settings
from torob.data.importer import ImportFailure, import_dataset


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="store-scout")
    commands = parser.add_subparsers(dest="command", required=True)
    ingest = commands.add_parser(
        "import-data", help="Validate/import the original Torob ZIP or CSVs"
    )
    ingest.add_argument(
        "source", type=Path, help="ZIP or directory containing the three original CSVs"
    )
    ingest.add_argument("--db", type=Path, default=Settings().db_path)
    ingest.add_argument("--report", type=Path, default=Path("var/reports/latest-import.json"))
    ingest.add_argument(
        "--replace", action="store_true", help="Atomically replace an existing dataset"
    )
    ingest.add_argument(
        "--allow-invalid", action="store_true", help="Skip rejected rows, report all"
    )
    ingest.add_argument(
        "--dry-run", action="store_true", help="Validate without modifying the target DB"
    )
    ingest.add_argument("--source-kind", choices=["sample", "provided"], default="provided")
    serve = commands.add_parser("serve", help="Run the catalog API")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--reload", action="store_true")
    serve.add_argument("--db", type=Path, default=Settings().db_path)
    args = parser.parse_args(argv)
    if args.command == "serve":
        import uvicorn

        os.environ["STORE_SCOUT_DB_PATH"] = str(args.db.resolve())
        uvicorn.run(
            "torob.api:create_app", factory=True, host=args.host, port=args.port, reload=args.reload
        )
        return 0
    try:
        report = import_dataset(
            args.source,
            args.db,
            replace=args.replace,
            allow_invalid=args.allow_invalid,
            dry_run=args.dry_run,
            source_kind=args.source_kind,
            progress=lambda table, counts: print(
                f"{table}: processed={counts.read}, rejected={counts.rejected}", flush=True
            ),
        )
        exit_code = 0
    except ImportFailure as error:
        report = error.report
        exit_code = 1
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(report.model_dump_json(indent=2) + "\n", encoding="utf-8")
    print(f"Status: {report.status}; committed: {report.committed}")
    for table, counts in report.counts.items():
        print(
            f"{table}: read={counts.read}, accepted={counts.accepted}, rejected={counts.rejected}"
        )
    print(f"Errors: {report.error_count}; warnings: {report.warning_count}")
    print(f"Quality report: {args.report}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
