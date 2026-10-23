"""Persistent capability-protected drafts with atomic revision checks across workers."""

import hashlib
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from .errors import IntentError
from .models import IntentRecord


class IntentStore:
    def __init__(
        self, path: Path, *, ttl_seconds=86400, capacity=1000, calls_per_minute=10, clock=time.time
    ):
        self.path, self.ttl_seconds, self.capacity = path, ttl_seconds, capacity
        self.calls_per_minute, self.clock = calls_per_minute, clock

    @contextmanager
    def connection(self):
        connection = sqlite3.connect(self.path, timeout=5)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def initialize(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS intents (id TEXT PRIMARY KEY, "
                "token_hash TEXT NOT NULL, revision INTEGER NOT NULL, "
                "expires INTEGER NOT NULL, payload TEXT NOT NULL)"
            )
            db.execute(
                "CREATE TABLE IF NOT EXISTS intent_quota "
                "(bucket INTEGER PRIMARY KEY, calls INTEGER NOT NULL)"
            )

    def reserve_provider_call(self):
        """Failed calls count too. A shared SQLite quota limits all app workers."""
        bucket = int(self.clock()) // 60
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM intent_quota WHERE bucket < ?", (bucket - 1,))
            count = db.execute(
                "SELECT calls FROM intent_quota WHERE bucket = ?", (bucket,)
            ).fetchone()
            if count and count[0] >= self.calls_per_minute:
                raise IntentError("intent_rate_limit")
            db.execute(
                "INSERT INTO intent_quota VALUES (?, 1) "
                "ON CONFLICT(bucket) DO UPDATE SET calls=calls+1",
                (bucket,),
            )

    def create(self, record: IntentRecord) -> str:
        token = secrets.token_urlsafe(32)
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM intents WHERE expires <= ?", (int(self.clock()),))
            if db.execute("SELECT COUNT(*) FROM intents").fetchone()[0] >= self.capacity:
                raise IntentError("intent_capacity")
            db.execute(
                "INSERT INTO intents VALUES (?, ?, ?, ?, ?)",
                (
                    record.draft_id,
                    _hash(token),
                    record.revision,
                    record.expires_at,
                    record.model_dump_json(),
                ),
            )
        return token

    def get(self, draft_id: str, token: str) -> IntentRecord:
        with self.connection() as db:
            return self.load(db, draft_id, token)

    def load(self, db, draft_id: str, token: str) -> IntentRecord:
        row = db.execute(
            "SELECT token_hash, expires, payload FROM intents WHERE id = ?", (draft_id,)
        ).fetchone()
        if (
            row is None
            or row[1] <= int(self.clock())
            or not secrets.compare_digest(row[0], _hash(token))
        ):
            raise IntentError("intent_not_found")
        return IntentRecord.model_validate_json(row[2])

    @contextmanager
    def edit(self, draft_id: str, token: str, expected_revision: int):
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            record = self.load(db, draft_id, token)
            if record.revision != expected_revision:
                raise IntentError("stale_intent")
            yield db, record

    @staticmethod
    def save(db, record: IntentRecord):
        db.execute(
            "UPDATE intents SET revision = ?, payload = ? WHERE id = ?",
            (
                record.revision,
                record.model_dump_json(),
                record.draft_id,
            ),
        )


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
