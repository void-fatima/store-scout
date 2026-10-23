"""Check a running Journey API using only the repository's synthetic sample."""

import argparse
import json
import time
from pathlib import Path

import httpx

from torob.catalog.contracts import CatalogPage, ErrorResponse
from torob.journey.models import ShoppingRequest
from torob.journey.recommendations import (
    AlternativeAcceptance,
    JourneyRecommendations,
    accept_alternative,
    comparison_keys,
    select_for_comparison,
)

PATH = "/api/v1/journey/recommendations"
ORIGIN = "http://localhost:5173"


def request_body(state):
    return ShoppingRequest.model_validate(
        state.model_dump(include=set(ShoppingRequest.model_fields))
    ).model_dump(mode="json")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument(
        "--report", type=Path, default=Path("var/reports/latest-journey-smoke.json")
    )
    args = parser.parse_args()
    checks = []
    with httpx.Client(base_url=args.base_url, timeout=30, trust_env=False) as client:

        def request(name, method, path=PATH, *, expected=200, **kwargs):
            started = time.perf_counter()
            response = client.request(method, path, **kwargs)
            assert response.status_code == expected, (
                name,
                response.status_code,
                response.text[:500],
            )
            checks.append(
                {
                    "name": name,
                    "method": method,
                    "path": path,
                    "status": response.status_code,
                    "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
                }
            )
            return response

        assert request("health", "GET", "/health").json()["data_ready"] is True
        catalog = CatalogPage.model_validate(
            request(
                "sample_catalog", "GET", "/api/v1/catalog/offers", params={"page_size": 100}
            ).json()
        )
        dataset = catalog.context.dataset
        if dataset is None or dataset.source_kind != "sample":
            raise RuntimeError("Journey smoke checks require the synthetic sample dataset.")
        request("swagger", "GET", "/docs")
        schema = request("openapi", "GET", "/openapi.json").json()
        assert schema["paths"][PATH]["post"]["responses"]["200"]["content"]["application/json"][
            "schema"
        ]["$ref"].endswith("/JourneyRecommendations")

        body = {
            "request_id": "sample-http-smoke",
            "revision": 0,
            "criteria": {
                "q": "گوشی سامسونگ",
                "max_budget": "200000000",
                "price_unit": "IRR",
                "latitude": 35.7,
                "longitude": 51.4,
                "max_distance_km": 5.0,
            },
            "comparison": None,
        }
        response = request("recommendations", "POST", json=body, headers={"Origin": ORIGIN})
        result = JourneyRecommendations.model_validate_json(response.content)
        assert result.result.original.context == catalog.context
        assert result.result.original_constraints.budget_toman == 20_000_000
        assert result.state.request_id == body["request_id"] and result.state.revision == 0
        assert len(result.result.original.recommendations) == 2
        assert {item.offer_id for item in result.result.original.recommendations} <= {
            item.offer_id for item in catalog.items
        }
        assert response.headers["access-control-allow-origin"] == ORIGIN

        selected = select_for_comparison(result, comparison_keys(result.result)[:1])
        compared = JourneyRecommendations.model_validate_json(
            request("comparison", "POST", json=request_body(selected.state)).content
        )
        assert compared.state.comparison == selected.state.comparison

        restricted = body | {"criteria": body["criteria"] | {"max_budget": "180000000"}}
        alternatives = JourneyRecommendations.model_validate_json(
            request("alternatives", "POST", json=restricted).content
        )
        assert not alternatives.result.original.recommendations
        assert alternatives.result.suggestions
        assert alternatives.state.criteria.max_budget == 180_000_000
        suggestion = alternatives.result.suggestions[0]
        # Scripted acceptance is sample input, never inferred consent from a user.
        accepted = accept_alternative(
            alternatives,
            AlternativeAcceptance(
                request_id=alternatives.state.request_id,
                expected_revision=alternatives.state.revision,
                dataset_id=dataset.dataset_id,
                offer_id=suggestion.result.offer_id,
                accepted_changes=tuple(suggestion.changes),
            ),
            current_state=alternatives.state,
        )
        fresh = JourneyRecommendations.model_validate_json(
            request(
                "fresh_search_after_sample_acceptance", "POST", json=request_body(accepted)
            ).content
        )
        assert fresh.state.revision == 1 and fresh.state.comparison is None
        assert fresh.result.original.recommendations
        assert fresh.result.original_constraints == suggestion.relaxed_constraints
        assert fresh.result.original.context == catalog.context

        empty = JourneyRecommendations.model_validate_json(
            request(
                "empty_result",
                "POST",
                json=body | {"criteria": body["criteria"] | {"q": "محصول ناموجود"}},
            ).content
        )
        assert not empty.result.original.recommendations and not empty.result.suggestions
        for name, patch, code in [
            ("invalid_request", {"latitude": 91}, "invalid_request"),
            ("missing_information", {"q": None}, "missing_information"),
        ]:
            error = request(
                name, "POST", expected=422, json=body | {"criteria": body["criteria"] | patch}
            )
            assert ErrorResponse.model_validate(error.json()).error.code == code
        malformed = request(
            "malformed_json",
            "POST",
            expected=422,
            content='{"request_id":',
            headers={"Content-Type": "application/json"},
        )
        assert ErrorResponse.model_validate(malformed.json()).error.code == "invalid_request"

        preflight = request(
            "post_preflight",
            "OPTIONS",
            headers={
                "Origin": ORIGIN,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        assert preflight.headers["access-control-allow-origin"] == ORIGIN
        assert "POST" in preflight.headers["access-control-allow-methods"].split(", ")
        denied = request(
            "rejected_origin",
            "OPTIONS",
            expected=400,
            headers={
                "Origin": "https://unrelated.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert "access-control-allow-origin" not in denied.headers

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(
            {
                "status": "passed",
                "sample_only": True,
                "notice": "Synthetic sample acceptance; no user consent or stock verification.",
                "dataset": dataset.model_dump(mode="json"),
                "checks": checks,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"{len(checks)} Journey HTTP checks passed; report: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
