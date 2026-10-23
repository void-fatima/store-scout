"""Versioned preparation; only a user-confirmed persisted revision reaches Journey."""

import threading
import uuid
from collections.abc import Callable

from torob.journey.models import ShoppingRequest
from torob.journey.recommendations import JourneyRecommendations, run_recommendations
from torob.recommend.catalog import CatalogSource

from .errors import IntentError
from .extraction import Interpreter, configured_interpreter
from .models import (
    CreatedIntent,
    ExtractedFields,
    IntentFields,
    IntentPatch,
    IntentRecord,
    IntentView,
    Provenance,
)
from .normalize import present
from .store import IntentStore


class IntentService:
    def __init__(
        self,
        store: IntentStore,
        *,
        interpreter_factory: Callable[[], Interpreter] = configured_interpreter,
    ):
        self.store = store
        self._interpreter_factory = interpreter_factory
        self._provider_slots = threading.BoundedSemaphore(2)

    def _extract(self, message: str) -> ExtractedFields:
        if not self._provider_slots.acquire(blocking=False):
            raise IntentError("intent_rate_limit")
        try:
            interpreter = self._interpreter_factory()
            self.store.reserve_provider_call()
            return interpreter.extract(message)
        finally:
            self._provider_slots.release()

    def create(self, message: str) -> CreatedIntent:
        extraction = self._extract(message)
        fields, provenance = self._merge(
            IntentFields(), {}, self._model_patch(extraction), "model_interpretation"
        )
        record = IntentRecord(
            draft_id=uuid.uuid4().hex,
            revision=0,
            expires_at=int(self.store.clock()) + self.store.ttl_seconds,
            fields=fields,
            provenance=provenance,
            shopping_related=extraction.shopping_related,
        )
        invalid = False
        try:
            view = present(record)
        except IntentError:
            invalid = True
        if invalid:
            raise IntentError("invalid_interpretation")
        token = self.store.create(record)
        return CreatedIntent(draft=view, access_token=token)

    def get(self, draft_id: str, token: str) -> IntentView:
        return present(self.store.get(draft_id, token))

    def revise(
        self,
        draft_id: str,
        token: str,
        revision: int,
        *,
        message: str | None = None,
        changes: IntentPatch | None = None,
    ) -> IntentView:
        original = self.store.get(draft_id, token)
        if original.revision != revision:
            raise IntentError("stale_intent")
        source = "user_supplied"
        if message is not None:
            extraction = self._extract(message)
            if not extraction.shopping_related:
                raise IntentError("invalid_criteria")
            changes, source = self._model_patch(extraction), "model_interpretation"
            if not changes.model_fields_set:
                raise IntentError("invalid_interpretation")
        if changes is None or not changes.model_fields_set:
            raise IntentError("invalid_intent_request")
        fields, provenance = self._merge(original.fields, original.provenance, changes, source)
        updated = original.model_copy(
            update={
                "fields": fields,
                "provenance": provenance,
                "revision": revision + 1,
                "decision": "pending",
                "shopping_related": True,
            }
        )
        view = present(updated)
        with self.store.edit(draft_id, token, revision) as (db, current):
            # A confirmation racing extraction must not be silently discarded.
            if current.decision != original.decision:
                raise IntentError("stale_intent")
            self.store.save(db, updated)
        return view

    def confirm(self, draft_id: str, token: str, revision: int) -> IntentView:
        with self.store.edit(draft_id, token, revision) as (db, record):
            view = present(record)
            if view.status not in {"awaiting_confirmation", "confirmed"}:
                raise IntentError("confirmation_required")
            confirmed = record.model_copy(update={"decision": "confirmed"})
            self.store.save(db, confirmed)
        return present(confirmed)

    def reject(self, draft_id: str, token: str, revision: int) -> IntentView:
        with self.store.edit(draft_id, token, revision) as (db, record):
            rejected = record.model_copy(update={"decision": "rejected", "revision": revision + 1})
            self.store.save(db, rejected)
        return present(rejected)

    def recommendations(
        self, draft_id: str, token: str, revision: int, source: CatalogSource
    ) -> JourneyRecommendations:
        # Hold the revision transaction through handoff: concurrent edits cannot
        # turn an already-checked version into different criteria during execution.
        with self.store.edit(draft_id, token, revision) as (_, record):
            view = present(record)
            if view.status != "confirmed" or view.issues:
                raise IntentError("confirmation_required")
            return run_recommendations(
                source,
                ShoppingRequest(
                    request_id=record.draft_id,
                    revision=record.revision,
                    criteria=view.criteria,
                ),
            )

    @staticmethod
    def _model_patch(extraction: ExtractedFields) -> IntentPatch:
        return IntentPatch.model_validate(
            {
                key: value
                for key, value in extraction.model_dump(exclude={"shopping_related"}).items()
                if value is not None and value != []
            }
        )

    @staticmethod
    def _merge(
        fields: IntentFields, provenance: dict[str, Provenance], patch: IntentPatch, source: str
    ):
        values, evidence = fields.model_dump(), dict(provenance)
        changes = patch.model_dump(exclude_unset=True)
        if "location" in changes and changes["location"] != fields.location:
            values["coordinates"] = None
            evidence.pop("coordinates", None)
        for key, value in changes.items():
            if key == "other_preferences" and value is None:
                value = []
            values[key] = value
            if value is None or value == []:
                evidence.pop(key, None)
            else:
                span = (
                    "user_map_selection"
                    if key == "coordinates"
                    else "؛ ".join(value)
                    if isinstance(value, list)
                    else value
                )
                evidence[key] = Provenance(source=source, evidence=span[:200])
        return IntentFields.model_validate(values), evidence
