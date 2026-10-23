"""Run offline: uv run --no-sync python -m torob.journey.example."""

import json

from torob.journey import prepare_catalog_request, start_journey, update_criteria


def main() -> None:
    # User criteria are illustrative; these are not offers or inferred locations.
    initial = start_journey(
        {
            "request_id": "sample-shopping-1",
            "criteria": {"q": "گوشی سامسونگ", "area": "ونک", "max_price_toman": 20_000_000},
        }
    )
    completed = update_criteria(initial.state, {"city": "تهران"})
    changed = update_criteria(
        completed.state, {"min_price_toman": 10_000_000, "max_price_toman": 25_000_000}
    )
    prepared = prepare_catalog_request(changed.state)
    print(
        json.dumps(
            {
                "sample_input": True,
                "notice": "Illustrative user criteria only; no catalog search, offers, ranking, "
                "recommendations, currency conversion, or geographic inference.",
                "steps": {
                    "initial_request": initial.model_dump(mode="json"),
                    "completed_information": completed.model_dump(mode="json"),
                    "changed_budget": changed.model_dump(mode="json"),
                    "prepared_catalog_request": prepared.model_dump(mode="json"),
                },
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
