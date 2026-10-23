import getpass
import json
import os
import subprocess
import sys
import warnings
from unittest.mock import Mock

import pytest

from torob.journey.llm import smoke
from torob.journey.llm.errors import ErrorCode, LLMError
from torob.journey.llm.transport import HTTPResult, HTTPSTransport

from .test_client import KEY, completion_body


@pytest.fixture(autouse=True)
def local_environment(monkeypatch):
    for name in ("STORE_SCOUT_LLM_API_KEY", "STORE_SCOUT_LLM_MODEL", "STORE_SCOUT_LLM_BASE_URL"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(sys, "stdin", Mock(isatty=lambda: False))
    monkeypatch.setattr(getpass, "getpass", Mock(side_effect=AssertionError("No terminal prompt")))
    monkeypatch.setattr("builtins.input", Mock(side_effect=AssertionError("No terminal prompt")))


def configured(monkeypatch):
    monkeypatch.setenv("STORE_SCOUT_LLM_API_KEY", KEY)
    monkeypatch.setenv("STORE_SCOUT_LLM_MODEL", "vendor/model")


def interactive(monkeypatch):
    monkeypatch.setattr(sys, "stdin", Mock(isatty=lambda: True))
    monkeypatch.setattr(sys, "stderr", Mock(isatty=lambda: True))


def test_without_live_never_loads_config_constructs_client_or_prompts(monkeypatch, capsys):
    configured(monkeypatch)
    forbidden = Mock(side_effect=AssertionError("No side effects without --live"))
    monkeypatch.setattr(smoke, "BoxAPIClient", forbidden)
    monkeypatch.setattr(smoke.LLMConfig, "from_env", forbidden)
    assert smoke.main([]) == 0
    assert "no provider request" in capsys.readouterr().out
    forbidden.assert_not_called()


def test_import_and_offline_module_entrypoint_never_use_network_or_prompt():
    script = """
import getpass, runpy, socket, sys
def forbidden(*args, **kwargs):
    raise AssertionError('unexpected external activity')
socket.socket.connect = forbidden
socket.getaddrinfo = forbidden
getpass.getpass = forbidden
import builtins
builtins.input = forbidden
from torob.journey.llm.config import LLMConfig
from torob.journey.llm.client import BoxAPIClient
BoxAPIClient(LLMConfig('test-credential', 'vendor/model'))
sys.argv = ['torob.journey.llm.smoke']
runpy.run_module('torob.journey.llm.smoke', run_name='__main__')
"""
    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        timeout=15,
        env={
            key: value
            for key, value in os.environ.items()
            if not key.startswith("STORE_SCOUT_LLM_")
        },
    )
    assert result.returncode == 0, result.stderr
    assert "Offline:" in result.stdout
    assert KEY not in result.stdout + result.stderr


@pytest.mark.parametrize("parameter", ["max_tokens", "max_completion_tokens"])
def test_live_opt_in_sends_one_small_persian_request(monkeypatch, capsys, parameter):
    configured(monkeypatch)
    post = Mock(return_value=HTTPResult(200, completion_body(KEY)))
    monkeypatch.setattr(HTTPSTransport, "post", post)
    assert smoke.main(["--live", "--output-limit-parameter", parameter]) == 0
    post.assert_called_once()
    payload = json.loads(post.call_args.kwargs["body"])
    assert payload[parameter] == 64
    assert payload["model"] == "vendor/model"
    assert payload["messages"] == [{"role": "user", "content": "لطفاً فقط بنویس: سلام"}]
    output = capsys.readouterr()
    assert "Success:" in output.out and "does not verify the shopping intent workflow" in output.out
    assert KEY not in output.out + output.err
    assert "vendor/model" not in output.out + output.err


def test_live_interactive_prompts_nonsecret_model_parameter_and_hidden_key(monkeypatch):
    interactive(monkeypatch)
    user_input = Mock(side_effect=["vendor/model", "max_tokens"])
    secure_input = Mock(return_value=KEY)
    monkeypatch.setattr("builtins.input", user_input)
    monkeypatch.setattr(getpass, "getpass", secure_input)
    post = Mock(return_value=HTTPResult(200, completion_body()))
    monkeypatch.setattr(HTTPSTransport, "post", post)
    assert smoke.main(["--live"]) == 0
    assert user_input.call_count == 2
    secure_input.assert_called_once_with("BoxAPI key (hidden): ")
    post.assert_called_once()
    assert "STORE_SCOUT_LLM_API_KEY" not in os.environ


@pytest.mark.parametrize(
    ("key", "model", "expected"),
    [(None, "vendor/model", "missing_api_key"), (KEY, None, "missing_model")],
)
def test_noninteractive_missing_configuration_never_prompts(
    monkeypatch, capsys, key, model, expected
):
    if key:
        monkeypatch.setenv("STORE_SCOUT_LLM_API_KEY", key)
    if model:
        monkeypatch.setenv("STORE_SCOUT_LLM_MODEL", model)
    post = Mock(side_effect=AssertionError("No network without configuration"))
    monkeypatch.setattr(HTTPSTransport, "post", post)
    assert smoke.main(["--live", "--output-limit-parameter", "max_tokens"]) == 1
    output = capsys.readouterr()
    assert expected in output.err and KEY not in output.err
    post.assert_not_called()


def test_no_unverified_limit_parameter_is_sent(monkeypatch, capsys):
    configured(monkeypatch)
    post = Mock(side_effect=AssertionError("No unbounded live request"))
    monkeypatch.setattr(HTTPSTransport, "post", post)
    assert smoke.main(["--live"]) == 2
    assert "output-limit-parameter" in capsys.readouterr().err
    post.assert_not_called()


def test_secure_prompt_refuses_echo_fallback(monkeypatch):
    interactive(monkeypatch)
    monkeypatch.setenv("STORE_SCOUT_LLM_MODEL", "vendor/model")

    def insecure_prompt(*_):
        warnings.warn("terminal unavailable", getpass.GetPassWarning, stacklevel=2)
        raise AssertionError("Must not fall back to visible input")

    monkeypatch.setattr(getpass, "getpass", insecure_prompt)
    post = Mock(side_effect=AssertionError("No request without secure key entry"))
    monkeypatch.setattr(HTTPSTransport, "post", post)
    assert smoke.main(["--live", "--output-limit-parameter", "max_tokens"]) == 2
    post.assert_not_called()


@pytest.mark.parametrize("code", list(ErrorCode))
def test_smoke_prints_only_sanitized_failure_and_never_retries(monkeypatch, capsys, code):
    configured(monkeypatch)
    post = Mock(side_effect=LLMError(code))
    monkeypatch.setattr(HTTPSTransport, "post", post)
    assert smoke.main(["--live", "--output-limit-parameter", "max_tokens"]) == 1
    output = capsys.readouterr()
    assert code.value in output.err
    assert KEY not in output.out + output.err
    assert "Success:" not in output.out
    post.assert_called_once()
