import math

import pytest

from torob.journey.llm.config import DEFAULT_BASE_URL, LLMConfig
from torob.journey.llm.errors import ErrorCode, LLMError


def test_explicit_environment_and_safe_repr():
    config = LLMConfig.from_env(
        {"STORE_SCOUT_LLM_API_KEY": "test-credential", "STORE_SCOUT_LLM_MODEL": "vendor/model"}
    )
    assert config.base_url == DEFAULT_BASE_URL
    assert config.model == "vendor/model"
    assert "test-credential" not in repr(config)
    assert "vendor/model" not in repr(config)


@pytest.mark.parametrize(
    ("env", "code"),
    [
        ({}, ErrorCode.MISSING_API_KEY),
        ({"STORE_SCOUT_LLM_API_KEY": "test-credential"}, ErrorCode.MISSING_MODEL),
        ({"BOX_API_KEY": "ignored", "MODEL": "ignored"}, ErrorCode.MISSING_API_KEY),
    ],
)
def test_missing_environment(env, code):
    with pytest.raises(LLMError) as error:
        LLMConfig.from_env(env)
    assert error.value.code == code


@pytest.mark.parametrize(
    "changes",
    [
        {"api_key": "test-credential\n"},
        {"api_key": "YOUR_API_KEY"},
        {"api_key": "کلید"},
        {"api_key": " "},
        {"model": "vendor/model\n"},
        {"model": " "},
        {"model": "YOUR_ACCOUNT_MODEL_ID"},
        {"model": "test-credential"},
        {"base_url": "http://ai.boxapi.ir/ai/v1"},
        {"base_url": "https://user:test-credential@ai.boxapi.ir/ai/v1"},
        {"base_url": "https://ai.boxapi.ir/ai/v1?key=test-credential"},
        {"base_url": "https://ai.boxapi.ir/ai/v1#test-credential"},
        {"base_url": "https://ai.boxapi.ir:invalid"},
        {"base_url": "https://[invalid"},
        {"base_url": "https://ai.boxapi.ir/\n"},
        {"base_url": "https://ai.boxapi.ir/\\bad"},
        {"base_url": ""},
        {"base_url": None},
        {"timeout_seconds": 0},
        {"timeout_seconds": 61},
        {"timeout_seconds": 10**1000},
        {"timeout_seconds": math.inf},
        {"timeout_seconds": math.nan},
        {"timeout_seconds": True},
        {"max_response_bytes": 0},
        {"max_response_bytes": 1_048_577},
        {"max_response_bytes": True},
    ],
)
def test_invalid_configuration_is_sanitized(changes):
    with pytest.raises(LLMError) as error:
        LLMConfig(**({"api_key": "test-credential", "model": "vendor/model"} | changes))
    assert error.value.code == ErrorCode.INVALID_CONFIGURATION
    assert "test-credential" not in str(error.value.as_dict())
    assert error.value.__context__ is None


def test_custom_https_base_and_limits():
    config = LLMConfig("test-credential", "vendor/model", "https://example.com:8443/v1/", 2, 128)
    assert config.base_url == "https://example.com:8443/v1"
