"""Run the real pinned integration API against a disposable synthetic database."""

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

FRONTEND = Path(__file__).resolve().parents[1]
ROOT = FRONTEND.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8017)
    args = parser.parse_args()
    source = json.loads((FRONTEND / "scripts/contract-source.json").read_text(encoding="utf-8"))

    def git(*arguments):
        return subprocess.check_output(["git", "-C", str(ROOT), *arguments])

    # Read the actual pending backend without checking it out or changing it.
    with tempfile.TemporaryDirectory(prefix="store-scout-journey-http-") as directory:
        temporary = Path(directory)
        files = (
            git("ls-tree", "-r", "--name-only", source["journeyRef"], "src").decode().splitlines()
        )
        for name in files:
            if not name.endswith(".py") or "/tests/" in name:
                continue
            target = temporary / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(git("show", f"{source['journeyRef']}:{name}"))
        sys.path.insert(0, str(temporary / "src"))

        import uvicorn

        from torob.api import create_app
        from torob.config import Settings
        from torob.data.importer import import_dataset

        database = temporary / "sample.sqlite3"
        import_dataset(ROOT / "datasets/sample", database, source_kind="sample")
        print(f"Temporary synthetic API from {source['journeyRef']}; no existing database is used.")
        uvicorn.run(create_app(Settings(db_path=database)), host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
