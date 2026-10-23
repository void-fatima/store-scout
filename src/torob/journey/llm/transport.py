"""Single direct HTTPS POST, verified TLS, bounded reads, no redirects or retries."""

import http.client
import time
from dataclasses import dataclass, field
from typing import Protocol
from urllib.parse import urlsplit

from .errors import ErrorCode, LLMError


@dataclass(frozen=True)
class HTTPResult:
    status: int
    body: bytes = field(repr=False)


class Transport(Protocol):
    """Injected implementations must enforce the same timeout and body byte limits."""

    def post(
        self,
        url: str,
        *,
        api_key: str,
        body: bytes,
        timeout_seconds: float,
        max_response_bytes: int,
    ) -> HTTPResult: ...


class HTTPSTransport:
    def post(
        self,
        url: str,
        *,
        api_key: str,
        body: bytes,
        timeout_seconds: float,
        max_response_bytes: int,
    ) -> HTTPResult:
        # URL was validated by LLMConfig. http.client does not follow redirects,
        # use proxy/netrc environment credentials, retry, or decompress responses.
        target = urlsplit(url)
        connection = http.client.HTTPSConnection(
            target.hostname, target.port, timeout=timeout_seconds
        )
        deadline = time.monotonic() + timeout_seconds
        try:
            connection.connect()
            sock = connection.sock

            def remaining_timeout():
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError
                sock.settimeout(remaining)

            remaining_timeout()
            connection.request(
                "POST",
                target.path,
                body=body,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Accept-Encoding": "identity",
                },
            )
            remaining_timeout()
            with connection.getresponse() as response:
                # Never follow a redirect, even to the same origin.
                if 300 <= response.status < 400:
                    return HTTPResult(response.status, b"")
                length = response.getheader("Content-Length")
                if length is not None:
                    if not length.isascii() or not length.isdecimal():
                        raise LLMError(ErrorCode.MALFORMED_RESPONSE)
                    if int(length) > max_response_bytes:
                        raise LLMError(ErrorCode.RESPONSE_TOO_LARGE)
                if response.getheader("Content-Encoding", "identity").lower() != "identity":
                    raise LLMError(ErrorCode.MALFORMED_RESPONSE)
                result = bytearray()
                while not response.isclosed():
                    remaining_timeout()
                    chunk = response.read1(min(8192, max_response_bytes + 1 - len(result)))
                    if not chunk:
                        break
                    result.extend(chunk)
                    if len(result) > max_response_bytes:
                        raise LLMError(ErrorCode.RESPONSE_TOO_LARGE)
                if length is not None and len(result) != int(length):
                    raise LLMError(ErrorCode.MALFORMED_RESPONSE)
                return HTTPResult(response.status, bytes(result))
        finally:
            connection.close()
