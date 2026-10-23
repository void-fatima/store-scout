import http.client
import json

import pytest

from torob.journey.intent.extraction import ExtractionConfig, LLMInterpreter
from torob.journey.intent.models import ExtractedFields
from torob.journey.intent.service import IntentService
from torob.journey.intent.store import IntentStore
from torob.journey.llm.client import BoxAPIClient, OutputLimitParameter
from torob.journey.llm.config import LLMConfig
from torob.journey.llm.transport import HTTPResult


def extracted(**changes):
    return {
        "shopping_related": True,
        **{
            name: None
            for name in (
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
        "other_preferences": [],
        **changes,
    }


class Provider:
    def __init__(self):
        self.output = extracted(product_query="گوشی سامسونگ", max_budget="۳۰ میلیون تومان")
        self.reason = "stop"
        self.status = 200
        self.error = None
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if self.error:
            raise self.error
        text = (
            self.output
            if isinstance(self.output, str)
            else json.dumps(self.output, ensure_ascii=False)
        )
        return HTTPResult(
            self.status,
            json.dumps(
                {
                    "choices": [
                        {
                            "finish_reason": self.reason,
                            "message": {"role": "assistant", "content": text},
                        }
                    ]
                }
            ).encode(),
        )

    def interpreter(self):
        return LLMInterpreter(
            BoxAPIClient(
                LLMConfig("unit-test-key", "vendor/model"),
                transport=self,
                max_output_tokens_limit=1024,
            ),
            ExtractionConfig(OutputLimitParameter.MAX_TOKENS),
        )


@pytest.fixture(autouse=True)
def no_provider_network(monkeypatch):
    def forbidden(*_args, **_kwargs):
        raise AssertionError("Real provider calls are forbidden in automated tests")

    monkeypatch.setattr(http.client.HTTPSConnection, "connect", forbidden)


@pytest.fixture
def provider():
    return Provider()


@pytest.fixture
def service(tmp_path, provider):
    store = IntentStore(tmp_path / "intent.sqlite3")
    store.initialize()
    return IntentService(store, interpreter_factory=provider.interpreter)


@pytest.fixture
def intent_client(client, provider):
    client.app.state.intent._interpreter_factory = provider.interpreter
    return client


@pytest.fixture
def interpreted_fields():
    return ExtractedFields.model_validate(
        extracted(product_query="گوشی سامسونگ", max_budget="۳۰ میلیون تومان")
    )
