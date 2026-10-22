"""lexical-v1: product intent first, then fixed normalized criteria and offer ID."""

from datetime import datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from torob.catalog.contracts import OfferCandidate, distance_km
from torob.catalog.text import normalize_text

from .models import (
    CandidateBatch,
    DataLimitation,
    ExplanationReason,
    RankingStrategy,
    RecommendationResponse,
    RecommendationResult,
    ScoreBreakdown,
    ShoppingCriteria,
)

# A small, explicit lexical policy, not semantic product identification. The
# first recognized noun distinguishes "phone case" from "phone with a case".
_PRODUCT_NOUNS = {
    "گوشی": "phone",
    "موبایل": "phone",
    "تلفن": "phone",
    "phone": "phone",
    "smartphone": "phone",
    "لپتاپ": "laptop",
    "laptop": "laptop",
    "notebook": "laptop",
    "هدفون": "headphones",
    "هدست": "headphones",
    "هندزفری": "headphones",
    "headphone": "headphones",
    "headphones": "headphones",
    "headset": "headphones",
    "earbuds": "headphones",
    "تبلت": "tablet",
    "tablet": "tablet",
    "تلویزیون": "tv",
    "tv": "tv",
    "television": "tv",
    "کتری": "kettle",
    "kettle": "kettle",
    "ساعت": "watch",
    "watch": "watch",
    "smartwatch": "watch",
    "قاب": "case",
    "کاور": "case",
    "case": "case",
    "cases": "case",
    "cover": "case",
    "گلس": "protector",
    "محافظ": "protector",
    "protector": "protector",
    "شارژر": "charger",
    "charger": "charger",
    "کابل": "cable",
    "cable": "cable",
    "بند": "strap",
    "strap": "strap",
    "هولدر": "holder",
    "holder": "holder",
    "کیف": "bag",
    "bag": "bag",
    "sleeve": "bag",
}
_ACCESSORIES = {"case", "protector", "charger", "cable", "strap", "holder", "bag"}


def _product_kind(text: str) -> str | None:
    words = normalize_text(text).split()
    for index, word in enumerate(words):
        if words[index : index + 2] == ["لپ", "تاپ"]:
            return "laptop"
        pair = tuple(words[index : index + 2])
        compounds = {
            ("phone", "case"): "case",
            ("laptop", "bag"): "bag",
            ("watch", "strap"): "strap",
            ("screen", "protector"): "protector",
        }
        if pair in compounds:
            return compounds[pair]
        if word in _PRODUCT_NOUNS:
            return _PRODUCT_NOUNS[word]
    return None


def _product_match(query: str, candidate: OfferCandidate) -> tuple[float, int, int]:
    tokens = set(normalize_text(query).split())
    query_kind = _product_kind(query)
    item_kind = _product_kind(candidate.product.persian_title) or _product_kind(
        candidate.product.category_name or ""
    )
    if query_kind and item_kind and query_kind != item_kind:
        return 0.0, 0, len(tokens)
    text = " ".join(
        value
        for value in (
            candidate.product.persian_title,
            candidate.product.brand_name,
            candidate.product.model,
        )
        if value
    )
    direct = normalize_text(text).split()
    category = normalize_text(candidate.product.category_name or "").split()
    matched = 0
    weighted = 0.0
    for token in tokens:
        if any(word.startswith(token) for word in direct):
            matched += 1
            weighted += 1.0
        elif any(word.startswith(token) for word in category):
            matched += 1
            weighted += 0.5
    score = weighted / len(tokens)
    if query_kind is None and item_kind in _ACCESSORIES:
        # Ambiguous model/brand-only searches can retain accessories, but cannot
        # rank them above a matching main product on the strength of price.
        score *= 0.25
    return score, matched, len(tokens)


def _tehran_time(value: datetime) -> datetime | None:
    try:
        return value.astimezone(ZoneInfo("Asia/Tehran"))
    except ZoneInfoNotFoundError:
        return None


def _opening_fit(candidate: OfferCandidate, criteria: ShoppingCriteria) -> tuple[float | None, str]:
    if criteria.shopping_time is None:
        return None, "shopping_time_unknown"
    local_time = _tehran_time(criteria.shopping_time)
    if local_time is None:
        return None, "opening_hours_unsupported"
    day = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")[local_time.weekday()]
    record = candidate.shop.weekly_hours.get(day)
    if record is None:
        return None, "opening_hours_unknown"
    if not isinstance(record, dict) or record.get("status") != "declared":
        return None, "opening_hours_unsupported"
    shifts = record.get("shifts")
    if not isinstance(shifts, list) or not shifts:
        return None, "opening_hours_unsupported"
    intervals = []
    for shift in shifts:
        if not isinstance(shift, dict):
            return None, "opening_hours_unsupported"
        start, end = shift.get("start_time"), shift.get("end_time")
        if not isinstance(start, str) or not isinstance(end, str):
            return None, "opening_hours_unsupported"
        try:
            start_time, end_time = time.fromisoformat(start), time.fromisoformat(end)
        except ValueError:
            return None, "opening_hours_unsupported"
        if start_time.tzinfo is not None or end_time.tzinfo is not None or start_time >= end_time:
            return None, "opening_hours_unsupported"
        intervals.append((start_time, end_time))
    current = local_time.time().replace(tzinfo=None)
    return float(any(start <= current < end for start, end in intervals)), ""


def _purchase_fit(
    candidate: OfferCandidate, criteria: ShoppingCriteria
) -> tuple[float | None, bool]:
    preferences = criteria.preferred_purchase_conditions
    if preferences is None:
        return None, False
    requested = sum(
        value is not None
        for value in (
            preferences.payment_methods,
            preferences.warranty_available,
            preferences.return_window_days,
        )
    )
    if requested == 0:
        return None, False
    # Only explicit machine tokens support a match; prose and raw warranty/
    # return fields are not reliable normalized evidence.
    methods = {value for value in candidate.shop.payment_options if isinstance(value, str)}
    match = bool(preferences.payment_methods and methods.intersection(preferences.payment_methods))
    if not match:
        return None, True
    return 1.0 / requested, requested > 1


def _score_candidate(
    candidate: OfferCandidate,
    criteria: ShoppingCriteria,
    strategy: RankingStrategy,
    product_match: float,
    matched: int,
    token_count: int,
    distance: float | None,
) -> RecommendationResult:
    assert candidate.price_toman is not None
    budget_fit = 1.0 - candidate.price_toman / criteria.budget_toman
    scale = criteria.max_distance_km or strategy.distance_scale_km
    distance_fit = None if distance is None else max(0.0, 1.0 - distance / scale)
    opening_fit, opening_limitation = _opening_fit(candidate, criteria)
    purchase_fit, purchase_unknown = _purchase_fit(candidate, criteria)
    breakdown = ScoreBreakdown(
        product_match=product_match,
        budget_fit=budget_fit,
        distance_fit=distance_fit,
        opening_hours_fit=opening_fit,
        purchase_conditions_fit=purchase_fit,
    )
    overall = (
        strategy.relevance_weight * product_match
        + strategy.price_weight * budget_fit
        + strategy.distance_weight * (distance_fit or 0.0)
        + strategy.opening_hours_weight * (opening_fit or 0.0)
        + strategy.purchase_conditions_weight * (purchase_fit or 0.0)
    )
    reasons = [
        ExplanationReason(
            code="product_match",
            message=f"در عنوان، برند، مدل یا دستهٔ ثبت‌شدهٔ محصول، {matched} از "
            f"{token_count} واژهٔ جست‌وجو پیدا شد؛ یکسان بودن دقیق مدل تضمین نمی‌شود.",
        ),
        ExplanationReason(
            code="within_budget",
            message=f"قیمت ثبت‌شدهٔ {candidate.price_toman:,} تومان از سقف "
            f"{criteria.budget_toman:,} تومان بیشتر نیست؛ قیمت فعلی باید بررسی شود.",
        ),
    ]
    limitations = [
        DataLimitation(
            code="inventory_not_verified",
            message="آفر ثبت‌شده اثبات موجودی نیست؛ پیش از مراجعه موجودی را بررسی کنید.",
        ),
        DataLimitation(
            code="recorded_price_not_live",
            message="قیمت ثبت‌شده ممکن است با قیمت فعلی فروشگاه تفاوت داشته باشد.",
        ),
        DataLimitation(
            code="price_freshness_unknown",
            message="زمان تغییر قیمت، زمان تأیید قیمت فعلی یا موجودی نیست.",
        ),
    ]
    if distance is not None:
        reasons.append(
            ExplanationReason(
                code="distance",
                message=f"فاصلهٔ مستقیم محاسبه‌شده {distance:.3f} کیلومتر است؛ "
                "این مقدار مسافت خیابانی یا زمان سفر نیست.",
            )
        )
    else:
        limitations.append(
            DataLimitation(
                code="user_location_unknown" if criteria.latitude is None else "location_unknown",
                message="فاصله نامشخص است و امتیاز مثبت دریافت نمی‌کند.",
            )
        )
    if opening_limitation:
        limitations.append(
            DataLimitation(
                code=opening_limitation,
                message="ساعت کاری در زمان درخواستی روشن نیست؛ امتیاز آن نامشخص است.",
            )
        )
    elif opening_fit:
        reasons.append(
            ExplanationReason(
                code="declared_opening_hours",
                message="زمان درخواستی تهران در ساعت کاری ثبت‌شده قرار دارد؛ "
                "این برنامهٔ اعلام‌شده، باز بودن واقعی فروشگاه را تضمین نمی‌کند.",
            )
        )
    if purchase_fit is not None:
        reasons.append(
            ExplanationReason(
                code="recorded_payment_option",
                message="یک روش پرداخت درخواستی به‌صورت کد صریح در گزینه‌های ثبت‌شده وجود دارد؛ "
                "شرایط فعلی فروشگاه باید بررسی شود.",
            )
        )
    if purchase_unknown:
        limitations.append(
            DataLimitation(
                code="purchase_conditions_unknown",
                message="بخشی از شرایط خرید نامشخص است و امتیاز مثبت دریافت نمی‌کند.",
            )
        )
    return RecommendationResult(
        offer_id=candidate.offer_id,
        product_id=candidate.product.product_id,
        shop_id=candidate.shop.shop_id,
        candidate=candidate,
        overall_score=min(1.0, max(0.0, overall)),
        score_breakdown=breakdown,
        explanation_reasons=reasons,
        data_limitations=limitations,
    )


def rank_candidates(
    criteria: ShoppingCriteria,
    batch: CandidateBatch,
    strategy: RankingStrategy | None = None,
) -> RecommendationResponse:
    criteria = ShoppingCriteria.model_validate(criteria.model_dump())
    batch = CandidateBatch.model_validate(batch.model_dump())
    strategy = RankingStrategy.model_validate((strategy or RankingStrategy()).model_dump())
    excluded = dict.fromkeys(
        ["irrelevant", "unknown_price", "over_budget", "unknown_distance", "outside_radius"], 0
    )
    results = []
    for candidate in batch.candidates:
        relevance, matched, token_count = _product_match(criteria.query, candidate)
        if relevance == 0:
            excluded["irrelevant"] += 1
            continue
        if candidate.price_toman is None:
            excluded["unknown_price"] += 1
            continue
        if candidate.price_toman > criteria.budget_toman:
            excluded["over_budget"] += 1
            continue
        distance = distance_km(
            criteria.latitude, criteria.longitude, candidate.shop.lat, candidate.shop.lon
        )
        if criteria.max_distance_km is not None:
            if distance is None:
                excluded["unknown_distance"] += 1
                continue
            if distance > criteria.max_distance_km:
                excluded["outside_radius"] += 1
                continue
        results.append(
            _score_candidate(
                candidate, criteria, strategy, relevance, matched, token_count, distance
            )
        )
    results.sort(
        key=lambda item: (-item.score_breakdown.product_match, -item.overall_score, item.offer_id)
    )
    response = RecommendationResponse(
        strategy=strategy,
        context=batch.context,
        coverage=batch.coverage,
        considered_count=len(batch.candidates),
        eligible_count=len(results),
        excluded_counts=excluded,
        recommendations=results[: strategy.max_results],
    )
    response.notices.append("lexical_matching_does_not_confirm_exact_product_identity")
    if not batch.coverage.complete_for_query:
        response.notices.append("price_sorted_page_limit_may_omit_better_matches")
    if batch.context.dataset is None:
        response.notices.append("catalog_has_no_imported_dataset")
    if not results:
        response.notices.append("no_eligible_offers")
    return response
