"""Intent error descriptions must not depend on Python's HTTPStatus phrases."""

from torob.api import create_app


def test_intent_error_descriptions_are_explicit_and_portable():
    paths = create_app().openapi()["paths"]
    operations = [
        operation
        for path, methods in paths.items()
        if path.startswith("/api/v1/journey/intents")
        for operation in methods.values()
    ]
    assert operations
    for operation in operations:
        assert operation["responses"]["413"]["description"] == "Content Too Large"
        assert operation["responses"]["422"]["description"] == "Unprocessable Content"
