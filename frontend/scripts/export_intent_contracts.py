"""Generate additive frontend contracts and fixtures from the pinned owning models."""

import json
import tempfile
from pathlib import Path
from unittest.mock import patch
from uuid import UUID

from pinned_intent import ROOT, FixtureInterpreter, pinned_source


def schema(models, mode):
    from pydantic.json_schema import models_json_schema

    _, definitions = models_json_schema([(model, mode) for model in models])
    return definitions


def main():
    with pinned_source():
        from torob.journey.intent.models import (
            ConfirmIntent,
            CreatedIntent,
            CreateIntent,
            IntentView,
            ReviseIntent,
            VersionRequest,
        )
        from torob.journey.intent.service import IntentService
        from torob.journey.intent.store import IntentStore
        from torob.journey.recommendations import JourneyRecommendations

        from torob.catalog.repository import CatalogRepository
        from torob.data.importer import import_dataset

        with tempfile.TemporaryDirectory(prefix="store-scout-intent-fixtures-") as directory:
            store = IntentStore(Path(directory) / "drafts.sqlite3", clock=lambda: 4102358400)
            store.initialize()
            service = IntentService(store, interpreter_factory=FixtureInterpreter)
            with (
                patch("torob.journey.intent.service.uuid.uuid4", return_value=UUID("a" * 32)),
                patch(
                    "torob.journey.intent.store.secrets.token_urlsafe",
                    return_value="fixture-capability-never-a-provider-key",
                ),
            ):
                created = service.create("گوشی سامسونگ تا ۳۰ میلیون تومان")
            ready = service.revise(
                created.draft.draft_id,
                created.access_token,
                0,
                changes=ReviseIntent.model_validate(
                    {
                        "expected_revision": 0,
                        "changes": {
                            "coordinates": {"latitude": 35.7, "longitude": 51.4},
                            "radius": "۵ کیلومتر",
                        },
                    }
                ).changes,
            )
            confirmed = service.confirm(created.draft.draft_id, created.access_token, 1)
            catalog = Path(directory) / "catalog.sqlite3"
            import_dataset(ROOT / "datasets/sample", catalog, source_kind="sample")
            journey = service.recommendations(
                created.draft.draft_id, created.access_token, 1, CatalogRepository(catalog)
            ).model_dump(mode="json")
            journey["result"]["original"]["context"]["dataset"]["imported_at"] = (
                "2026-10-01T00:00:00Z"
            )
            journey = JourneyRecommendations.model_validate(journey).model_dump(mode="json")
            rejected = service.reject(created.draft.draft_id, created.access_token, 1)
            print(
                json.dumps(
                    {
                        "requests": schema(
                            [CreateIntent, ReviseIntent, ConfirmIntent, VersionRequest],
                            "validation",
                        ),
                        "responses": schema([IntentView, CreatedIntent], "serialization"),
                        "fixtures": {
                            "createdIntentFixture": created.model_dump(mode="json"),
                            "readyIntentFixture": ready.model_dump(mode="json"),
                            "confirmedIntentFixture": confirmed.model_dump(mode="json"),
                            "intentJourneyFixture": journey,
                            "rejectedIntentFixture": rejected.model_dump(mode="json"),
                        },
                    }
                )
            )


if __name__ == "__main__":
    main()
