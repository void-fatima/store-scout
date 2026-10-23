import socket

import pytest


@pytest.fixture(autouse=True)
def forbid_live_network(monkeypatch):
    def forbidden(*_args, **_kwargs):
        raise AssertionError("Unit tests must never use a real network connection")

    monkeypatch.setattr(socket.socket, "connect", forbidden)
    monkeypatch.setattr(socket, "getaddrinfo", forbidden)
