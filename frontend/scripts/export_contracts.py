"""Export owning Pydantic schemas and validated fixtures without backend edits."""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

FRONTEND = Path(__file__).resolve().parents[1]
ROOT = FRONTEND.parent
SOURCE = json.loads((FRONTEND / "scripts/contract-source.json").read_text(encoding="utf-8"))


def git(*args):
    return subprocess.check_output(["git", "-C", str(ROOT), *args])


def schema(models, mode):
    from pydantic.json_schema import models_json_schema

    refs, definitions = models_json_schema([(model, mode) for model in models])
    return {
        **definitions,
        "title": "BackendContracts",
        "type": "object",
        "additionalProperties": False,
        "properties": {model.__name__: refs[model, mode] for model in models},
        "required": [model.__name__ for model in models],
    }


def fixture(model, name):
    wrapped = json.loads((ROOT / "src/torob/recommend/examples" / name).read_text(encoding="utf-8"))
    # Execute model validators too: JSON Schema alone cannot express their rules.
    return model.model_validate(wrapped["data"]).model_dump(mode="json")


def main():
    sys.path.insert(0, str(ROOT / "src"))
    import torob

    # Read pending Journey files through their immutable Git objects. The current
    # worktree remains the authority for Recommendation and Catalog. No checkout,
    # merge, copied Python snapshot, application registration or CORS change.
    with tempfile.TemporaryDirectory(prefix="store-scout-frontend-contracts-") as directory:
        package = Path(directory) / "torob"
        paths = (
            git("ls-tree", "-r", "--name-only", SOURCE["journeyRef"], "src/torob/journey")
            .decode()
            .splitlines()
        )
        if not paths:
            raise RuntimeError("Pinned Journey source is unavailable; fetch origin first.")
        for name in paths:
            if name.endswith(".py") and "/tests/" not in name:
                target = package / Path(name).relative_to("src/torob")
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(git("show", f"{SOURCE['journeyRef']}:{name}"))
        torob.__path__.insert(0, str(package))

        from torob.journey.models import ShoppingRequest
        from torob.journey.recommendations import (
            AlternativeAcceptance,
            JourneyRecommendations,
            accept_alternative,
            run_recommendations,
        )

        from torob.catalog.contracts import ErrorDetail, ErrorResponse, ProductDetail
        from torob.catalog.repository import CatalogRepository
        from torob.data.importer import import_dataset
        from torob.recommend.alternative_models import AlternativesResponse
        from torob.recommend.models import RecommendationResponse

        # Keep request validation and response serialization separate: Decimal
        # accepts string/number on input, but serializes to an exact decimal string.
        result = {
            "requestSchema": schema([ShoppingRequest, AlternativeAcceptance], "validation"),
            "responseSchema": schema(
                [JourneyRecommendations, ErrorResponse, ProductDetail], "serialization"
            ),
            "fixtures": {
                "alternativesFixture": fixture(AlternativesResponse, "alternatives_response.json"),
                "recommendationFixture": fixture(
                    RecommendationResponse, "recommendation_response.json"
                ),
                "errorFixture": ErrorResponse(
                    error=ErrorDetail(
                        code="catalog_snapshot_changed",
                        message="Refresh the current catalog.",
                        details=[{"retryable": True}],
                    )
                ).model_dump(mode="json"),
            },
        }
        # Also validate the wire envelope and an exact-money input against Journey.
        request = ShoppingRequest.model_validate(
            {
                "request_id": "fixture-request",
                "revision": 3,
                "criteria": {
                    "q": "گوشی",
                    "max_budget": "17000000.123456789",
                    "price_unit": "TOMAN",
                    "latitude": 35.7,
                    "longitude": 51.4,
                },
            }
        )
        result["fixtures"]["requestFixture"] = request.model_dump(mode="json")
        # Recommendation's examples may omit coordinates; Journey requires them.
        # Derive its envelope through the real service using only synthetic data.
        db = Path(directory) / "sample.sqlite3"
        import_dataset(ROOT / "datasets/sample", db, source_kind="sample")
        detail = CatalogRepository(db).product("sample_product_phone").model_dump(mode="json")
        detail["context"]["dataset"]["imported_at"] = "2026-10-01T00:00:00Z"
        result["fixtures"]["productDetailFixture"] = ProductDetail.model_validate(
            detail
        ).model_dump(mode="json")
        service_response = run_recommendations(CatalogRepository(db), request)
        envelope = service_response.model_dump(mode="json")
        envelope["result"]["original"]["context"]["dataset"]["imported_at"] = "2026-10-01T00:00:00Z"
        result["fixtures"]["journeyFixture"] = JourneyRecommendations.model_validate_json(
            json.dumps(envelope, ensure_ascii=False)
        ).model_dump(mode="json")
        chosen = service_response.result.suggestions[0]
        accepted = accept_alternative(
            service_response,
            AlternativeAcceptance(
                request_id=request.request_id,
                expected_revision=request.revision,
                dataset_id=service_response.result.original.context.dataset.dataset_id,
                offer_id=chosen.result.offer_id,
                accepted_changes=chosen.changes,
            ),
            current_state=service_response.state,
        )
        fresh_request = ShoppingRequest.model_validate(
            accepted.model_dump(include=set(ShoppingRequest.model_fields))
        )
        fresh = run_recommendations(CatalogRepository(db), fresh_request).model_dump(mode="json")
        fresh["result"]["original"]["context"]["dataset"]["imported_at"] = "2026-10-01T00:00:00Z"
        result["fixtures"]["acceptedJourneyFixture"] = JourneyRecommendations.model_validate_json(
            json.dumps(fresh, ensure_ascii=False)
        ).model_dump(mode="json")
        suggestion = result["fixtures"]["alternativesFixture"]["suggestions"][0]
        result["fixtures"]["acceptanceFixture"] = AlternativeAcceptance.model_validate(
            {
                "request_id": request.request_id,
                "expected_revision": request.revision,
                "dataset_id": result["fixtures"]["alternativesFixture"]["original"]["context"][
                    "dataset"
                ]["dataset_id"],
                "offer_id": suggestion["result"]["offer_id"],
                "accepted_changes": suggestion["changes"],
            }
        ).model_dump(mode="json")
        print(json.dumps(result, ensure_ascii=True, sort_keys=True))


if __name__ == "__main__":
    main()
