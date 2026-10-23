"""Offline API walkthrough: mocked interpretation, actual sample Catalog data.

Requires development dependencies. There is no live mode or credential loading.
"""

import json
import tempfile
from pathlib import Path

from torob.journey.llm.transport import HTTPResult


class FixtureTransport:
    def post(self, _url, **_kwargs):
        fields = {
            "shopping_related": True,
            "product_query": "گوشی سامسونگ",
            "brand": "سامسونگ",
            "category": "گوشی",
            "max_budget": "۳۰ میلیون تومان",
            "min_budget": None,
            "location": None,
            "radius": None,
            "warranty": None,
            "installments": None,
            "return_window": None,
            "other_preferences": [],
        }
        return HTTPResult(
            200,
            json.dumps(
                {
                    "choices": [
                        {
                            "finish_reason": "stop",
                            "message": {
                                "role": "assistant",
                                "content": json.dumps(fields, ensure_ascii=False),
                            },
                        }
                    ]
                }
            ).encode(),
        )


def main() -> int:
    from fastapi.testclient import TestClient

    from torob.api import create_app
    from torob.config import Settings
    from torob.data.importer import import_dataset
    from torob.journey.intent.extraction import ExtractionConfig, LLMInterpreter
    from torob.journey.llm.client import BoxAPIClient, OutputLimitParameter
    from torob.journey.llm.config import LLMConfig

    sample = Path(__file__).resolve().parents[4] / "datasets" / "sample"
    with tempfile.TemporaryDirectory(prefix="store-scout-intent-demo-") as directory:
        db = Path(directory) / "catalog.sqlite3"
        import_dataset(sample, db, source_kind="sample")
        with TestClient(create_app(Settings(db_path=db))) as client:
            client.app.state.intent._interpreter_factory = lambda: LLMInterpreter(
                BoxAPIClient(
                    LLMConfig("offline-fixture-key", "fixture-model"),
                    transport=FixtureTransport(),
                    max_output_tokens_limit=1024,
                ),
                ExtractionConfig(OutputLimitParameter.MAX_COMPLETION_TOKENS),
            )
            root = "/api/v1/journey/intents"
            created = client.post(root, json={"message": "گوشی سامسونگ تا ۳۰ میلیون تومان"})
            created.raise_for_status()
            data = created.json()
            headers = {"Authorization": "Bearer " + data["access_token"]}
            path = root + "/" + data["draft"]["draft_id"]
            print("Offline demo: mocked model interpretation; no paid provider request.")
            print("Created:", data["draft"]["status"])
            blocked = client.post(
                path + "/recommendations", headers=headers, json={"expected_revision": 0}
            )
            if blocked.status_code != 409:
                raise RuntimeError("Unconfirmed search was not blocked")
            revised = client.post(
                path + "/revise",
                headers=headers,
                json={
                    "expected_revision": 0,
                    "changes": {
                        "coordinates": {"latitude": 35.7, "longitude": 51.4},
                        "radius": "۵ کیلومتر",
                    },
                },
            )
            revised.raise_for_status()
            print("Revised:", revised.json()["status"])
            confirmed = client.post(
                path + "/confirm", headers=headers, json={"expected_revision": 1, "confirm": True}
            )
            confirmed.raise_for_status()
            print("Decision:", confirmed.json()["status"])
            result = client.post(
                path + "/recommendations", headers=headers, json={"expected_revision": 1}
            )
            result.raise_for_status()
            count = len(result.json()["result"]["original"]["recommendations"])
            print("Actual sample Catalog recommendations:", count)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
