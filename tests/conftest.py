from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from torob.api import create_app
from torob.config import Settings
from torob.data.importer import import_dataset

SAMPLE = Path(__file__).resolve().parents[1] / "datasets" / "sample"


@pytest.fixture
def db_path(tmp_path):
    path = tmp_path / "catalog.sqlite3"
    import_dataset(SAMPLE, path, source_kind="sample")
    return path


@pytest.fixture
def client(db_path):
    with TestClient(create_app(Settings(db_path=db_path))) as client:
        yield client
