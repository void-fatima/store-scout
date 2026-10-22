"""Offline sample-only integration demo; never touch an existing database."""

import json
from pathlib import Path
from tempfile import TemporaryDirectory

from torob.catalog.repository import CatalogRepository
from torob.data.importer import import_dataset
from torob.journey.intake import start_journey
from torob.journey.recommendations import (
    AlternativeAcceptance,
    accept_alternative,
    run_recommendations,
)


def main() -> None:
    with TemporaryDirectory(prefix="journey-sample-") as directory:
        db_path = Path(directory) / "sample.sqlite3"
        sample = Path(__file__).resolve().parents[3] / "datasets" / "sample"
        import_dataset(sample, db_path, source_kind="sample")
        source = CatalogRepository(db_path)
        state = start_journey(
            {
                "request_id": "sample-only-request",
                "criteria": {
                    "q": "گوشی سامسونگ",
                    "max_budget": "180000000",
                    "price_unit": "IRR",
                    "latitude": 35.7,
                    "longitude": 51.4,
                    "max_distance_km": 5.0,
                },
            }
        ).state
        original = run_recommendations(source, state)
        suggestion = original.result.suggestions[0]
        # Scripted acceptance is illustrative input, never an inferred user action.
        accepted = accept_alternative(
            original,
            AlternativeAcceptance(
                request_id=state.request_id,
                expected_revision=state.revision,
                dataset_id=original.result.original.context.dataset.dataset_id,
                offer_id=suggestion.result.offer_id,
                accepted_changes=tuple(suggestion.changes),
            ),
            current_state=state,
        )
        fresh = run_recommendations(source, accepted)
        print(
            json.dumps(
                {
                    "sample_only": True,
                    "notice": "Synthetic sample; explicit sample acceptance; stock unverified.",
                    "original": original.model_dump(mode="json"),
                    "fresh_after_explicit_sample_acceptance": fresh.model_dump(mode="json"),
                },
                ensure_ascii=True,
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
