import sqlite3
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import Mock

import pytest

from torob.journey.intent.errors import IntentError
from torob.journey.intent.models import IntentPatch
from torob.journey.intent.service import IntentService
from torob.journey.intent.store import IntentStore

from .conftest import extracted

MESSAGE = "گوشی سامسونگ تا ۳۰ میلیون تومان"
READY = {"coordinates": {"latitude": 35.7, "longitude": 51.4}, "radius": "۵ کیلومتر"}


def ready(service):
    created = service.create(MESSAGE)
    view = service.revise(
        created.draft.draft_id, created.access_token, 0, changes=IntentPatch.model_validate(READY)
    )
    return created, view


def test_draft_revision_preserves_constraints_and_tracks_provenance(service, provider):
    created, view = ready(service)
    assert view.status == "awaiting_confirmation" and view.revision == 1
    assert view.provenance["product_query"].source == "model_interpretation"
    assert view.provenance["coordinates"].source == "user_supplied"
    provider.output = extracted(max_budget="۴۰ میلیون تومان")
    revised = service.revise(
        view.draft_id, created.access_token, 1, message="بودجه تا ۴۰ میلیون تومان"
    )
    assert revised.criteria.q == "گوشی سامسونگ"
    assert revised.criteria.max_budget == 40_000_000
    assert revised.criteria.latitude == 35.7 and revised.criteria.max_distance_km == 5
    assert revised.provenance["max_budget"].evidence == "۴۰ میلیون تومان"
    assert len(provider.calls) == 2


def test_only_explicit_confirmation_of_current_revision_allows_handoff(service, monkeypatch):
    created, view = ready(service)
    source = Mock()
    handoff = Mock(return_value="canonical-result")
    monkeypatch.setattr("torob.journey.intent.service.run_recommendations", handoff)
    with pytest.raises(IntentError):
        service.recommendations(view.draft_id, created.access_token, 1, source)
    handoff.assert_not_called()
    service.confirm(view.draft_id, created.access_token, 1)
    assert (
        service.recommendations(view.draft_id, created.access_token, 1, source)
        == "canonical-result"
    )
    forwarded = handoff.call_args.args[1]
    assert forwarded.criteria == view.criteria
    assert forwarded.request_id == view.draft_id and forwarded.revision == 1
    assert handoff.call_args.args[0] is source


def test_modify_confirmed_draft_invalidates_confirmation_and_old_versions(service):
    created, view = ready(service)
    service.confirm(view.draft_id, created.access_token, 1)
    updated = service.revise(
        view.draft_id, created.access_token, 1, changes=IntentPatch(max_budget="۴۰ میلیون تومان")
    )
    assert updated.status == "awaiting_confirmation" and updated.revision == 2
    for action in (service.confirm, service.reject):
        with pytest.raises(IntentError) as error:
            action(view.draft_id, created.access_token, 1)
        assert error.value.response.error.code == "stale_intent"
    with pytest.raises(IntentError):
        service.recommendations(view.draft_id, created.access_token, 2, Mock())


def test_rejected_and_incomplete_drafts_never_execute(service):
    created = service.create(MESSAGE)
    for action in (service.confirm,):
        with pytest.raises(IntentError):
            action(created.draft.draft_id, created.access_token, 0)
    rejected = service.reject(created.draft.draft_id, created.access_token, 0)
    assert rejected.status == "rejected" and rejected.revision == 1
    with pytest.raises(IntentError):
        service.recommendations(rejected.draft_id, created.access_token, 1, Mock())
    revised = service.revise(
        rejected.draft_id, created.access_token, 1, changes=IntentPatch.model_validate(READY)
    )
    assert revised.status == "awaiting_confirmation" and revised.revision == 2


def test_changing_location_discards_old_coordinates(service):
    created, view = ready(service)
    updated = service.revise(
        view.draft_id, created.access_token, 1, changes=IntentPatch(location="ونک")
    )
    assert updated.fields.coordinates is None
    assert updated.status == "needs_clarification"
    mismatch = service.revise(
        view.draft_id,
        created.access_token,
        2,
        changes=IntentPatch.model_validate(
            {
                "coordinates": {
                    "latitude": 35.7,
                    "longitude": 51.4,
                    "for_location": "صادقیه",
                }
            }
        ),
    )
    assert any(issue.field == "coordinates" for issue in mismatch.issues)


def test_bad_patch_preserves_original_revision_and_confirmation(service):
    created, view = ready(service)
    service.confirm(view.draft_id, created.access_token, 1)
    with pytest.raises(IntentError):
        service.revise(
            view.draft_id, created.access_token, 1, changes=IntentPatch(max_budget="-۳ تومان")
        )
    actual = service.get(view.draft_id, created.access_token)
    assert (
        actual.revision == 1 and actual.status == "confirmed" and actual.criteria == view.criteria
    )


def test_explicit_null_clears_only_selected_constraint(service):
    created, view = ready(service)
    updated = service.revise(
        view.draft_id, created.access_token, 1, changes=IntentPatch(max_budget=None)
    )
    assert (
        updated.fields.max_budget is None
        and updated.fields.product_query == view.fields.product_query
    )
    assert updated.fields.coordinates == view.fields.coordinates
    assert "max_budget" not in updated.provenance


def test_store_survives_service_restart_and_capability_is_hashed(service):
    created, view = ready(service)
    restarted = IntentService(IntentStore(service.store.path))
    assert restarted.get(view.draft_id, created.access_token) == view
    assert created.access_token not in repr(created)
    with sqlite3.connect(service.store.path) as db:
        raw = repr(db.execute("SELECT * FROM intents").fetchall())
    assert created.access_token not in raw
    with pytest.raises(IntentError):
        restarted.get(view.draft_id, "wrong-token")


def test_expired_draft_is_not_readable_or_confirmable(service):
    created, view = ready(service)
    service.store.clock = lambda: view.expires_at
    for action in (service.get,):
        with pytest.raises(IntentError):
            action(view.draft_id, created.access_token)
    with pytest.raises(IntentError):
        service.confirm(view.draft_id, created.access_token, 1)


def test_two_worker_stale_write_is_rejected(service):
    created, view = ready(service)
    other = IntentService(IntentStore(service.store.path))

    def update(instance, amount):
        try:
            return instance.revise(
                view.draft_id, created.access_token, 1, changes=IntentPatch(max_budget=amount)
            ).revision
        except IntentError as error:
            return error.response.error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(
                lambda pair: update(*pair),
                [(service, "۴۰ میلیون تومان"), (other, "۵۰ میلیون تومان")],
            )
        )
    assert sorted(map(str, results)) == ["2", "stale_intent"]


def test_failed_provider_calls_use_shared_quota_and_do_not_retry(service, provider):
    service.store.calls_per_minute = 1
    provider.error = TimeoutError("unit-test-key")
    from torob.journey.llm.errors import LLMError

    with pytest.raises(LLMError):
        service.create(MESSAGE)
    other = IntentService(
        IntentStore(service.store.path, calls_per_minute=1),
        interpreter_factory=provider.interpreter,
    )
    with pytest.raises(IntentError) as error:
        other.create(MESSAGE)
    assert error.value.response.error.code == "intent_rate_limit" and len(provider.calls) == 1
