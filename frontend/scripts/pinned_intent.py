"""Load the immutable intent reference read-only; never use credentials/configuration."""

import json
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

FRONTEND = Path(__file__).resolve().parents[1]
ROOT = FRONTEND.parent
REFERENCE = json.loads((FRONTEND / "scripts/intent-source.json").read_text())["intentRef"]


@contextmanager
def pinned_source():
    with tempfile.TemporaryDirectory(prefix="store-scout-intent-source-") as directory:
        source = Path(directory)
        files = (
            subprocess.check_output(
                ["git", "-C", str(ROOT), "ls-tree", "-r", "--name-only", REFERENCE, "src"]
            )
            .decode()
            .splitlines()
        )
        if not files:
            raise RuntimeError("Pinned intent source missing; fetch origin first")
        for name in files:
            if name.endswith(".py") and "/tests/" not in name:
                target = source / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(
                    subprocess.check_output(["git", "-C", str(ROOT), "show", f"{REFERENCE}:{name}"])
                )
        sys.path.insert(0, str(source / "src"))
        yield source


class FixtureInterpreter:
    """Only deterministic test interpretation; no provider or environment access."""

    def extract(self, message):
        from torob.journey.intent.models import ExtractedFields

        examples = {
            "گوشی سامسونگ تا ۳۰ میلیون تومان": {
                "product_query": "گوشی سامسونگ",
                "max_budget": "۳۰ میلیون تومان",
            },
            "منظورم ۳۰ میلیون تومان بود": {"max_budget": "۳۰ میلیون تومان"},
            "گوشی سامسونگ تا ۳۰ تومن": {"product_query": "گوشی سامسونگ", "max_budget": "۳۰ تومن"},
            "گوشی سامسونگ تا ۱۸ میلیون تومان": {
                "product_query": "گوشی سامسونگ",
                "max_budget": "۱۸ میلیون تومان",
            },
        }
        if message not in examples:
            from torob.journey.intent.errors import IntentError

            raise IntentError("invalid_interpretation")
        return ExtractedFields(
            shopping_related=True,
            **{
                field: examples[message].get(field)
                for field in (
                    "product_query",
                    "brand",
                    "category",
                    "max_budget",
                    "min_budget",
                    "location",
                    "radius",
                    "warranty",
                    "installments",
                    "return_window",
                )
            },
            other_preferences=[],
        )
