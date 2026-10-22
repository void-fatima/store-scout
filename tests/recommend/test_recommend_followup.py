"""MOCK-only verification plans; no seller is contacted."""

import json

import pytest
from pydantic import ValidationError

from torob.recommend.followup import plan_before_visit
from torob.recommend.followup_models import FollowupPlan


def test_unknown_information_stays_unknown(offer_factory, criteria_factory):
    offer = offer_factory(
        "mock-unknown",
        price_toman=None,
        last_price_changed_at=None,
        weekly_hours={},
        payment_options=[],
        warranty=None,
    )
    plan = plan_before_visit(offer, criteria_factory())
    assert plan.recorded_price_toman is None
    assert plan.last_price_changed_at is None
    assert plan.opening_hours_status == "unknown"
    assert plan.recorded_weekly_hours is None
    assert plan.payment_status == "unknown"
    assert plan.recorded_payment_options is None
    assert plan.warranty_status == "unknown"
    assert plan.recorded_warranty is None
    assert "نامشخص" in plan.checklist[1].question


def test_preserves_recorded_evidence_without_verifying_it(offer_factory, criteria_factory):
    offer = offer_factory(
        "mock-recorded",
        price_toman=12300000,
        last_price_changed_at="2026-10-01T10:00:00Z",
        weekly_hours={
            "sat": {
                "status": "declared",
                "shifts": [
                    {"start_time": "09:00", "end_time": "18:00"},
                ],
            }
        },
        payment_options=["card"],
        warranty="MOCK warranty text",
    )
    criteria = criteria_factory(
        shopping_time="2026-10-24T12:00:00+03:30",
        preferred_purchase_conditions={
            "payment_methods": ["installments"],
            "warranty_available": True,
            "return_window_days": 7,
        },
    )
    plan = plan_before_visit(offer, criteria)
    assert plan.recorded_price_toman == offer.price_toman
    assert plan.last_price_changed_at == offer.last_price_changed_at
    assert plan.recorded_weekly_hours == offer.shop.weekly_hours
    assert plan.opening_hours_status == "recorded_unverified"
    assert plan.payment_status == "recorded_unverified"
    assert plan.recorded_warranty == offer.warranty
    assert plan.price_verification_status == plan.warranty_status == "unknown"
    assert plan.shopping_time == criteria.shopping_time
    assert "اقساط" in next(q.question for q in plan.checklist if q.topic == "payment")
    assert "7" in next(q.question for q in plan.checklist if q.topic == "returns")
    assert all(q.state == "pending" and q.evidence_paths for q in plan.checklist)


@pytest.mark.parametrize(
    "hours",
    [
        {"sat": "09-18"},
        {"sat": {"status": "unsupported"}},
        {"sat": {"status": "declared", "shifts": []}},
        {"sat": {"status": "declared", "shifts": [None]}},
        {"sat": {"status": "declared", "shifts": [{"start_time": "oops"}]}},
        {
            "sat": {
                "status": "declared",
                "shifts": [
                    {"start_time": "20:00", "end_time": "02:00"},
                ],
            }
        },
    ],
)
def test_raw_or_unsupported_hours_never_establish_opening(hours, offer_factory, criteria_factory):
    plan = plan_before_visit(offer_factory("mock-hours", weekly_hours=hours), criteria_factory())
    assert plan.opening_hours_status == "unsupported"
    assert plan.recorded_weekly_hours == hours
    assert "تأیید" in next(q.question for q in plan.checklist if q.topic == "opening_hours")


def test_no_contacts_or_simulated_verification(offer_factory, criteria_factory):
    offer = offer_factory("mock-contact")
    offer.shop.contacts = [{"phone": "MOCK-NUMBER-DO-NOT-CONTACT"}]
    plan = plan_before_visit(offer, criteria_factory())
    assert plan.contact_attempted is False
    assert plan.contact_policy == "synthetic_contacts_not_for_contact"
    assert plan.availability == "unconfirmed"
    assert plan.requires_verification_before_visit is True
    assert plan.state == "awaiting_user_verification"
    assert "MOCK-NUMBER-DO-NOT-CONTACT" not in plan.model_dump_json()


@pytest.mark.parametrize(
    "field,value",
    [
        ("availability", "confirmed"),
        ("contact_attempted", True),
        ("requires_verification_before_visit", False),
        ("state", "verified"),
        ("price_verification_status", "verified"),
    ],
)
def test_cannot_serialize_completed_verification(field, value, offer_factory, criteria_factory):
    data = plan_before_visit(offer_factory("mock-state"), criteria_factory()).model_dump()
    data[field] = value
    with pytest.raises(ValidationError):
        FollowupPlan.model_validate(data)


def test_checklist_cannot_omit_inventory(offer_factory, criteria_factory):
    data = plan_before_visit(offer_factory("mock-state"), criteria_factory()).model_dump()
    data["checklist"] = data["checklist"][1:]
    with pytest.raises(ValidationError):
        FollowupPlan.model_validate(data)


def test_utf8_roundtrip_is_stable_and_does_not_mutate_inputs(
    offer_factory,
    criteria_factory,
    canonical_page,
):
    offer = offer_factory("mock-stable")
    criteria = criteria_factory()
    before = (
        offer.model_dump_json(),
        criteria.model_dump_json(),
        canonical_page.context.model_dump_json(),
    )
    first = plan_before_visit(offer, criteria, context=canonical_page.context)
    second = plan_before_visit(offer, criteria, context=canonical_page.context)
    assert first == second
    assert FollowupPlan.model_validate_json(first.model_dump_json()) == first
    text = json.dumps(first.model_dump(mode="json"), ensure_ascii=False)
    assert "آیا" in text and "????" not in text
    assert any("گوشی" in q.question for q in first.checklist)
    assert "contact_numbers_synthetic" in first.warnings
    assert before == (
        offer.model_dump_json(),
        criteria.model_dump_json(),
        canonical_page.context.model_dump_json(),
    )
