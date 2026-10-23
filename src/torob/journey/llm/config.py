"""Explicit server environment loading, with no dotenv or import-time side effects."""

from __future__ import annotations

import math
import os
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from urllib.parse import urlsplit

from .errors import ErrorCode, LLMError

DEFAULT_BASE_URL = "https://ai.boxapi.ir/ai/v1"


@dataclass(frozen=True)
class LLMConfig:
    # Hide all operator-supplied strings, including accidentally misplaced secrets.
    api_key: str = field(repr=False)
    model: str = field(repr=False)
    base_url: str = field(default=DEFAULT_BASE_URL, repr=False)
    timeout_seconds: float = 15.0
    max_response_bytes: int = 65_536

    def __post_init__(self):
        if not isinstance(self.api_key, str) or not self.api_key:
            raise LLMError(ErrorCode.MISSING_API_KEY)
        if not isinstance(self.model, str) or not self.model:
            raise LLMError(ErrorCode.MISSING_MODEL)
        valid = (
            1 <= len(self.api_key) <= 4096
            and all(33 <= ord(char) <= 126 for char in self.api_key)
            and self.api_key not in {"YOUR_API_KEY", "REPLACE_WITH_LOCAL_KEY"}
            and len(self.model) <= 200
            and self.model not in {"YOUR_MODEL", "YOUR_ACCOUNT_MODEL_ID"}
            and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9/_.:~-]*", self.model) is not None
            and isinstance(self.base_url, str)
            and isinstance(self.timeout_seconds, (int, float))
            and not isinstance(self.timeout_seconds, bool)
            and 0 < self.timeout_seconds <= 60
            and math.isfinite(self.timeout_seconds)
            and type(self.max_response_bytes) is int
            and 1 <= self.max_response_bytes <= 1_048_576
        )
        if not valid or not _valid_base_url(self.base_url):
            raise LLMError(ErrorCode.INVALID_CONFIGURATION)
        if self.api_key in self.base_url or self.api_key in self.model:
            raise LLMError(ErrorCode.INVALID_CONFIGURATION)
        object.__setattr__(self, "base_url", self.base_url.rstrip("/"))

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> LLMConfig:
        """Read only these three variables when called; .env files are not loaded."""
        env = os.environ if environ is None else environ
        return cls(
            api_key=env.get("STORE_SCOUT_LLM_API_KEY", ""),
            model=env.get("STORE_SCOUT_LLM_MODEL", ""),
            base_url=env.get("STORE_SCOUT_LLM_BASE_URL", DEFAULT_BASE_URL),
        )


def _valid_base_url(value: str) -> bool:
    if len(value) > 2048 or any(ord(char) < 33 or ord(char) > 126 for char in value):
        return False
    try:
        parsed = urlsplit(value)
        return bool(
            parsed.scheme == "https"
            and parsed.hostname
            and re.fullmatch(r"[A-Za-z0-9.:-]+", parsed.hostname)
            and parsed.username is None
            and parsed.password is None
            and not parsed.query
            and not parsed.fragment
            and "?" not in value
            and "#" not in value
            and "\\" not in value
            and (parsed.port is None or 1 <= parsed.port <= 65535)
        )
    except ValueError:
        return False
