import http.client
from io import BytesIO
from unittest.mock import Mock

import pytest

from torob.journey.llm.client import BoxAPIClient, OutputLimitParameter
from torob.journey.llm.config import LLMConfig
from torob.journey.llm.errors import ErrorCode, LLMError

from .test_client import KEY, completion_body


class FakeResponse:
    def __init__(self, body, *, status=200, headers=None):
        self.status = status
        self.body = body
        self.headers = headers or {}
        self.read_sizes = []
        self.closed = False

    def getheader(self, name, default=None):
        return self.headers.get(name, default)

    def read1(self, size):
        self.read_sizes.append(size)
        # Deliberately fragmented to exercise byte accounting across reads.
        chunk = self.body[: min(size, 17)]
        self.body = self.body[len(chunk) :]
        if not self.body:
            self.closed = True
        return chunk

    def isclosed(self):
        return self.closed

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.closed = True


def setup_connection(monkeypatch, response, *, limit=1024):
    connection = Mock()
    connection.getresponse.return_value = response
    factory = Mock(return_value=connection)
    monkeypatch.setattr(http.client, "HTTPSConnection", factory)
    client = BoxAPIClient(LLMConfig(KEY, "vendor/model", max_response_bytes=limit))
    return client, connection, factory


def complete(client):
    return client.complete("سلام", output_limit_parameter=OutputLimitParameter.MAX_TOKENS)


@pytest.mark.parametrize("with_length", [False, True])
def test_production_transport_builds_one_authenticated_https_post(monkeypatch, with_length):
    body = completion_body()
    response = FakeResponse(body, headers={"Content-Length": str(len(body))} if with_length else {})
    client, connection, factory = setup_connection(monkeypatch, response, limit=len(body))
    assert complete(client).text == "اتصال برقرار است."
    factory.assert_called_once_with("ai.boxapi.ir", None, timeout=15)
    connection.connect.assert_called_once()
    connection.request.assert_called_once()
    args, kwargs = connection.request.call_args
    assert args == ("POST", "/ai/v1/chat/completions")
    assert kwargs["headers"]["Authorization"] == f"Bearer {KEY}"
    assert kwargs["headers"]["Accept-Encoding"] == "identity"
    assert all(0 < size <= len(body) + 1 for size in response.read_sizes)
    connection.close.assert_called_once()
    assert response.closed


@pytest.mark.parametrize("with_length", [False, True])
def test_large_responses_bounded_before_or_during_read(monkeypatch, with_length):
    response = FakeResponse(b"x" * 200, headers={"Content-Length": "200"} if with_length else {})
    client, connection, _ = setup_connection(monkeypatch, response, limit=64)
    with pytest.raises(LLMError) as error:
        complete(client)
    assert error.value.code == ErrorCode.RESPONSE_TOO_LARGE
    assert error.value.__context__ is None
    if with_length:
        assert response.read_sizes == []
    else:
        assert 200 - len(response.body) == 65
    connection.close.assert_called_once()


@pytest.mark.parametrize("status", [301, 302, 307, 308])
def test_redirect_is_never_followed_or_read(monkeypatch, status):
    response = FakeResponse(b"ignored", status=status, headers={"Location": "https://other.test"})
    client, connection, factory = setup_connection(monkeypatch, response)
    with pytest.raises(LLMError) as error:
        complete(client)
    assert error.value.code == ErrorCode.REDIRECT_REFUSED
    assert response.read_sizes == []
    factory.assert_called_once()
    connection.request.assert_called_once()
    connection.close.assert_called_once()


@pytest.mark.parametrize(
    "headers",
    [{"Content-Length": "-1"}, {"Content-Length": "bad"}, {"Content-Encoding": "gzip"}],
)
def test_bad_framing_or_compression_rejected(monkeypatch, headers):
    client, connection, _ = setup_connection(monkeypatch, FakeResponse(b"ignored", headers=headers))
    with pytest.raises(LLMError) as error:
        complete(client)
    assert error.value.code == ErrorCode.MALFORMED_RESPONSE
    connection.close.assert_called_once()


def test_truncated_body_rejected(monkeypatch):
    response = FakeResponse(completion_body(), headers={"Content-Length": "999"})
    client, connection, _ = setup_connection(monkeypatch, response)
    with pytest.raises(LLMError) as error:
        complete(client)
    assert error.value.code == ErrorCode.MALFORMED_RESPONSE
    connection.close.assert_called_once()


@pytest.mark.parametrize("phase", ["connect", "request", "getresponse"])
def test_timeout_closes_connection_without_retry(monkeypatch, phase):
    client, connection, factory = setup_connection(monkeypatch, FakeResponse(completion_body()))
    getattr(connection, phase).side_effect = TimeoutError(KEY)
    with pytest.raises(LLMError) as error:
        complete(client)
    assert error.value.code == ErrorCode.TIMEOUT
    assert error.value.__context__ is None
    assert KEY not in str(error.value.as_dict())
    factory.assert_called_once()
    connection.close.assert_called_once()


def test_body_read_deadline_is_not_reset_by_each_chunk(monkeypatch):
    response = FakeResponse(completion_body())
    client, connection, _ = setup_connection(monkeypatch, response)
    times = iter([0, 1, 2, 3, 16])
    monkeypatch.setattr("torob.journey.llm.transport.time.monotonic", lambda: next(times))
    with pytest.raises(LLMError) as error:
        complete(client)
    assert error.value.code == ErrorCode.TIMEOUT
    assert len(response.read_sizes) == 1
    assert [call.args[0] for call in connection.sock.settimeout.call_args_list] == [14, 13, 12]
    connection.close.assert_called_once()


@pytest.mark.parametrize("framing", ["length", "chunked", "eof"])
def test_real_stdlib_response_parser_without_network(monkeypatch, framing):
    body = completion_body()
    if framing == "length":
        wire_body = b"Content-Length: " + str(len(body)).encode() + b"\r\n\r\n" + body
    elif framing == "chunked":
        wire_body = (
            b"Transfer-Encoding: chunked\r\n\r\n"
            + f"{len(body):x}\r\n".encode()
            + body
            + b"\r\n0\r\n\r\n"
        )
    else:
        wire_body = b"Connection: close\r\n\r\n" + body
    sock = Mock()
    sock.makefile.return_value = BytesIO(b"HTTP/1.1 200 OK\r\n" + wire_body)
    response = http.client.HTTPResponse(sock)
    response.begin()
    client, connection, _ = setup_connection(monkeypatch, response)
    assert complete(client).text == "اتصال برقرار است."
    assert response.isclosed()
    connection.close.assert_called_once()
