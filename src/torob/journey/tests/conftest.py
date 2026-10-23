"""Only a tiny existing synthetic sample is imported, always into pytest tmp_path."""

from pathlib import Path

import pytest

from torob.catalog.repository import CatalogRepository
from torob.data.importer import import_dataset
from torob.journey.intake import start_journey


@pytest.fixture
def journey_repository(tmp_path):
    sample = Path(__file__).resolve().parents[4] / "datasets" / "sample"
    path = tmp_path / "journey-sample.sqlite3"
    import_dataset(sample, path, source_kind="sample")
    return CatalogRepository(path)


@pytest.fixture
def journey_request():
    def make(**criteria):
        return start_journey(
            {
                "request_id": "sample-journey",
                "revision": 2,
                "criteria": {
                    "q": "گوشی سامسونگ",
                    "max_price_toman": 20_000_000,
                    "latitude": 35.7,
                    "longitude": 51.4,
                    "max_distance_km": 5.0,
                }
                | criteria,
            }
        ).state

    return make
