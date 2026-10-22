"""Pure before-visit planning: no network access, seller contact or verification action."""

from datetime import time

from torob.catalog.contracts import CatalogContext, OfferCandidate

from .followup_models import FollowupPlan, VerificationQuestion
from .models import ShoppingCriteria


def _hours_status(hours: dict) -> str:
    if not hours:
        return "unknown"
    # Declared intervals remain unverified. Raw prose/unsupported structures do not
    # establish opening hours, including overnight intervals unsupported by ranking.
    for record in hours.values():
        if not isinstance(record, dict) or record.get("status") != "declared":
            return "unsupported"
        shifts = record.get("shifts")
        if not isinstance(shifts, list) or not shifts:
            return "unsupported"
        for shift in shifts:
            if not isinstance(shift, dict):
                return "unsupported"
            try:
                start = time.fromisoformat(shift["start_time"])
                end = time.fromisoformat(shift["end_time"])
            except (KeyError, TypeError, ValueError):
                return "unsupported"
            if start.tzinfo is not None or end.tzinfo is not None or start >= end:
                return "unsupported"
    return "recorded_unverified"


def plan_before_visit(
    candidate: OfferCandidate,
    criteria: ShoppingCriteria,
    *,
    context: CatalogContext | None = None,
) -> FollowupPlan:
    candidate = OfferCandidate.model_validate(candidate.model_dump())
    criteria = ShoppingCriteria.model_validate(criteria.model_dump())
    preferences = criteria.preferred_purchase_conditions
    title = candidate.product.persian_title
    price = candidate.price_toman
    price_question = (
        f"آیا قیمت ثبت‌شدهٔ {price:,} تومان برای همین کالا هنوز معتبر است؟"
        if price is not None
        else "قیمت فعلی همین کالا چند تومان است؟ قیمت ثبت‌شده نامشخص است."
    )
    visit = (
        f"در زمان مراجعهٔ برنامه‌ریزی‌شده ({criteria.shopping_time.isoformat()})"
        if criteria.shopping_time is not None
        else "در زمان مراجعهٔ مورد نظر"
    )
    labels = {"cash": "نقدی", "card": "کارت", "installments": "اقساط"}
    methods = preferences.payment_methods if preferences else None
    payment = (
        "آیا روش پرداخت انتخاب‌شده ("
        + "، ".join(labels[m] for m in methods)
        + ") برای همین کالا پشتیبانی می‌شود و چه شرایطی دارد؟"
        if methods
        else "چه روش‌های پرداختی برای همین کالا پذیرفته می‌شود و شرایط هر روش چیست؟"
    )
    questions = [
        VerificationQuestion(
            topic="inventory",
            question=f"آیا همین کالای ثبت‌شده با عنوان «{title}» و مدل دقیق مورد نظر موجود است؟",
            evidence_paths=["candidate.offer_id", "candidate.product"],
        ),
        VerificationQuestion(
            topic="price",
            question=price_question,
            evidence_paths=["candidate.price_toman", "candidate.last_price_changed_at"],
        ),
        VerificationQuestion(
            topic="opening_hours",
            question=f"آیا فروشگاه {visit} باز است؟ ساعات کاری باید تأیید شود.",
            evidence_paths=["criteria.shopping_time", "candidate.shop.weekly_hours"],
        ),
        VerificationQuestion(
            topic="payment",
            question=payment,
            evidence_paths=[
                "criteria.preferred_purchase_conditions",
                "candidate.shop.payment_options",
            ],
        ),
        VerificationQuestion(
            topic="warranty",
            question="آیا همین کالا گارانتی معتبر دارد؟ شرکت، مدت و شرایط گارانتی چیست؟",
            evidence_paths=["candidate.warranty", "criteria.preferred_purchase_conditions"],
        ),
    ]
    if preferences and preferences.return_window_days is not None:
        questions.append(
            VerificationQuestion(
                topic="returns",
                question=(
                    f"آیا امکان بازگشت کالا تا {preferences.return_window_days} روز "
                    "با شرایط مشخص وجود دارد؟"
                ),
                evidence_paths=["criteria.preferred_purchase_conditions.return_window_days"],
            )
        )
    warnings = list(
        dict.fromkeys(
            [
                *(context.notices if context else []),
                "inventory_not_verified",
                "recorded_price_is_not_live",
                "price_timestamp_is_last_change_not_verification",
                "opening_hours_and_purchase_conditions_require_verification",
                "synthetic_contacts_not_for_contact",
                "no_seller_contact_or_verification_has_occurred",
                "tehran_coverage_incomplete",
            ]
        )
    )
    return FollowupPlan(
        offer_id=candidate.offer_id,
        product_id=candidate.product.product_id,
        shop_id=candidate.shop.shop_id,
        recorded_price_toman=price,
        last_price_changed_at=candidate.last_price_changed_at,
        shopping_time=criteria.shopping_time,
        requested_purchase_conditions=preferences,
        opening_hours_status=_hours_status(candidate.shop.weekly_hours),
        recorded_weekly_hours=candidate.shop.weekly_hours or None,
        payment_status="recorded_unverified" if candidate.shop.payment_options else "unknown",
        recorded_payment_options=candidate.shop.payment_options or None,
        recorded_warranty=candidate.warranty,
        checklist=questions,
        warnings=warnings,
    )
