"""Bounded Catalog-backed alternatives. No public routes or seller actions."""

import time
from collections.abc import Callable
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ValidationError

from torob.catalog.contracts import CatalogQuery, OfferCandidate, distance_km
from torob.catalog.text import normalize_text

from .alternative_models import (
    AlternativeDiagnosis,
    AlternativePolicy,
    AlternativesResponse,
    AlternativeSuggestion,
    ConstraintChange,
)
from .catalog import (
    CatalogAPIClient,
    CatalogRetrievalError,
    CatalogSnapshotChanged,
    CatalogSource,
    retrieve_candidates,
    retrieve_catalog_query,
)
from .followup import plan_before_visit
from .models import CandidateBatch, RankingStrategy, ShoppingCriteria
from .ranking import _product_match, _score_candidate, rank_candidates
from .service import RecommendationServiceError


class CatalogDeadlineExceeded(CatalogRetrievalError):
    code = "catalog_time_limit"
    retryable = True


class _DeadlineSource:
    """Cooperative total deadline; HTTP calls also get the remaining per-call time."""

    def __init__(self, source: CatalogSource, seconds: float, clock: Callable[[], float]):
        self.source = source
        self.clock = clock
        self.deadline = clock() + seconds
        self.calls = 0
        self.context = None

    def search(self, query: CatalogQuery):
        remaining = self.deadline - self.clock()
        if remaining <= 0:
            raise CatalogDeadlineExceeded("Catalog search deadline exceeded")
        source = self.source
        if isinstance(source, CatalogAPIClient):
            source = CatalogAPIClient(
                source.transport, timeout_seconds=min(source.timeout_seconds, remaining)
            )
        self.calls += 1
        page = source.search(query)
        if self.clock() >= self.deadline:
            raise CatalogDeadlineExceeded("Catalog search deadline exceeded")
        # Keep all probes on one snapshot, including empty responses.
        if hasattr(page, "context"):
            if self.context is not None and page.context != self.context:
                raise CatalogSnapshotChanged("Catalog context changed between probes")
            if self.context is None:
                self.context = page.context.model_copy(deep=True)
        return page


def _input(value: Any) -> Any:
    return value.model_dump() if isinstance(value, BaseModel) else value


def _relax(
    original: ShoppingCriteria, candidate: OfferCandidate, query: str, policy: AlternativePolicy
) -> ShoppingCriteria | None:
    if _product_match(query, candidate)[0] == 0 or candidate.price_toman is None:
        return None
    updates: dict[str, Any] = {"query": query}
    if candidate.price_toman > original.budget_toman:
        ceiling = policy.budget_limit_toman(original)
        if candidate.price_toman > ceiling:
            return None
        units = 10 if original.price_unit == "IRR" else 1
        updates["max_budget"] = Decimal(candidate.price_toman * units)
    radius = original.max_distance_km
    if radius is not None:
        distance = distance_km(
            original.latitude, original.longitude, candidate.shop.lat, candidate.shop.lon
        )
        if distance is None:
            return None
        if distance > radius:
            if distance > min(100, radius * policy.max_radius_multiplier):
                return None
            updates["max_distance_km"] = distance
    relaxed = ShoppingCriteria.model_validate(original.model_dump() | updates)
    if relaxed == original:
        return None
    if normalize_text(query) != normalize_text(original.query):
        score, matched, count = _product_match(original.query, candidate)
        if score > 0 and matched == count and len(updates) == 1:
            # Do not label a newly discovered original-qualified offer as relaxed.
            return None
    return relaxed


def _suggestion(
    original: ShoppingCriteria,
    relaxed: ShoppingCriteria,
    candidate: OfferCandidate,
    batch: CandidateBatch,
    strategy: RankingStrategy,
) -> AlternativeSuggestion:
    before = original.model_dump(mode="json")
    after = relaxed.model_dump(mode="json")
    changes = [
        ConstraintChange(field=key, original=before[key], relaxed=after[key])
        for key in ("query", "max_budget", "max_distance_km")
        if before[key] != after[key]
    ]
    labels = {
        "query": "جست‌وجوی محصول",
        "max_budget": "بودجه (" + ("ریال" if original.price_unit == "IRR" else "تومان") + ")",
        "max_distance_km": "شعاع کیلومتری",
    }
    detail = "؛ ".join(f"{labels[c.field]} از «{c.original}» به «{c.relaxed}»" for c in changes)
    kind = (
        "combined_relaxation"
        if len(changes) > 1
        else {
            "query": "product_query_change",
            "max_budget": "budget_increase",
            "max_distance_km": "radius_increase",
        }[changes[0].field]
    )
    score, matched, count = _product_match(relaxed.query, candidate)
    distance = distance_km(
        relaxed.latitude, relaxed.longitude, candidate.shop.lat, candidate.shop.lon
    )
    result = _score_candidate(candidate, relaxed, strategy, score, matched, count, distance)
    return AlternativeSuggestion(
        suggestion_type=kind,
        original_constraints=original,
        relaxed_constraints=relaxed,
        changes=changes,
        explanation=f"این جایگزین با فیلترهای اولیه تأیید نشده است؛ تغییر لازم: {detail}. "
        "پذیرش این تغییرها با شماست. پیشنهاد فقط بر پایهٔ رکورد آفر کاتالوگ است.",
        result=result,
        verification=plan_before_visit(candidate, relaxed, context=batch.context),
    )


def _diagnose(original: ShoppingCriteria, batch: CandidateBatch) -> list[AlternativeDiagnosis]:
    relevant = [c for c in batch.candidates if _product_match(original.query, c)[0] > 0]
    findings = []

    def add(code, message, candidates):
        findings.append(
            AlternativeDiagnosis(
                code=code, message=message, evidence_offer_ids=[c.offer_id for c in candidates]
            )
        )

    if not relevant:
        add(
            "no_matching_product_offers",
            "در رکوردهای بازیابی‌شده برای جست‌وجوی اولیه آفر محصول مناسب پیدا نشد؛ "
            "این نتیجه نبود کالا در کل بازار را ثابت نمی‌کند.",
            [],
        )
    unknown_price = [c for c in relevant if c.price_toman is None]
    over_budget = [
        c for c in relevant if c.price_toman is not None and c.price_toman > original.budget_toman
    ]
    if unknown_price:
        add(
            "missing_price_data",
            "قیمت برخی آفرهای مرتبط نامشخص است؛ در بودجه تأیید نمی‌شوند.",
            unknown_price,
        )
    if over_budget:
        add(
            "budget_too_restrictive",
            "قیمت ثبت‌شدهٔ برخی آفرهای مرتبط از بودجه بیشتر است.",
            over_budget,
        )
    unknown_geo, outside = [], []
    for candidate in relevant:
        distance = distance_km(
            original.latitude, original.longitude, candidate.shop.lat, candidate.shop.lon
        )
        if distance is None:
            unknown_geo.append(candidate)
        elif original.max_distance_km is not None and distance > original.max_distance_km:
            outside.append(candidate)
    if unknown_geo:
        add(
            "missing_geographic_data",
            "مختصات کاربر یا برخی فروشگاه‌ها نامشخص است؛ فاصله قابل تأیید نیست.",
            unknown_geo,
        )
    if outside:
        add("radius_too_restrictive", "برخی آفرهای مرتبط بیرون از شعاع اولیه هستند.", outside)
    if not findings:
        add(
            "no_suitable_offer_in_retrieved_records",
            "علت قطعی از بخش بازیابی‌شده مشخص نیست؛ فیلترها و پوشش را بازبینی کنید.",
            [],
        )
    return findings


def _order(suggestion: AlternativeSuggestion):
    original, relaxed = suggestion.original_constraints, suggestion.relaxed_constraints
    query_changed = normalize_text(original.query) != normalize_text(relaxed.query)
    budget_change = (relaxed.max_budget - original.max_budget) / original.max_budget
    radius_change = (
        (relaxed.max_distance_km - original.max_distance_km) / original.max_distance_km
        if original.max_distance_km is not None
        else 0
    )
    result = suggestion.result
    # Fewest changed constraints first. Preserve product query before numeric
    # relaxations; then prefer the smallest proportional total increase.
    return (
        len(suggestion.changes),
        query_changed,
        budget_change + Decimal(str(radius_change)),
        -result.score_breakdown.product_match,
        -result.overall_score,
        result.offer_id,
    )


def find_alternatives(
    source: CatalogSource,
    criteria: ShoppingCriteria | dict[str, Any],
    *,
    policy: AlternativePolicy | dict[str, Any] | None = None,
    strategy: RankingStrategy | dict[str, Any] | None = None,
    clock: Callable[[], float] = time.monotonic,
) -> AlternativesResponse:
    try:
        criteria = ShoppingCriteria.model_validate(_input(criteria))
        policy = AlternativePolicy.model_validate(_input(policy) if policy is not None else {})
        strategy = RankingStrategy.model_validate(_input(strategy) if strategy is not None else {})
    except ValidationError as exc:
        raise RecommendationServiceError(
            "invalid_recommendation_input", "ورودی درخواست جایگزین معتبر نیست."
        ) from exc
    bounded = _DeadlineSource(source, policy.max_total_seconds, clock)
    try:
        initial = retrieve_candidates(bounded, criteria, policy.retrieval)
        original = rank_candidates(criteria, initial, strategy)
        coverage = [initial.coverage]
        suggestions, diagnoses = [], []
        if not original.recommendations:
            queries = list(
                dict.fromkeys(
                    [
                        criteria.query,
                        *(
                            q
                            for q in policy.alternative_queries
                            if normalize_text(q) != normalize_text(criteria.query)
                        ),
                    ]
                )
            )
            for index, query in enumerate(queries):
                # Keep lexical product filtering. Remove budget/radius only for
                # diagnostic evidence, never for original-qualified recommendations.
                batch = retrieve_catalog_query(
                    bounded,
                    CatalogQuery(q=query, lat=criteria.latitude, lon=criteria.longitude),
                    policy.retrieval,
                )
                coverage.append(batch.coverage)
                if index == 0:
                    diagnoses.extend(_diagnose(criteria, batch))
                for candidate in batch.candidates:
                    relaxed = _relax(criteria, candidate, query, policy)
                    if relaxed is not None:
                        suggestions.append(
                            _suggestion(criteria, relaxed, candidate, batch, strategy)
                        )
        if any(not c.complete_for_query for c in coverage):
            diagnoses.append(
                AlternativeDiagnosis(
                    code="limited_catalog_coverage",
                    message="سقف صفحه‌بندی اجازهٔ بررسی همهٔ آفرهای همین جست‌وجو را نداد؛ "
                    "علت‌ها و جایگزین‌ها فقط به رکوردهای بازیابی‌شده محدود هستند.",
                )
            )
        suggestions.sort(key=_order)
        unique = {}
        for suggestion in suggestions:
            unique.setdefault(suggestion.result.offer_id, suggestion)
        return AlternativesResponse(
            original_constraints=criteria,
            policy=policy,
            original=original,
            original_verification=[
                plan_before_visit(r.candidate, criteria, context=initial.context)
                for r in original.recommendations
            ],
            diagnoses=diagnoses,
            suggestions=list(unique.values())[: policy.max_suggestions],
            coverage=coverage,
            catalog_requests=bounded.calls,
            warnings=list(
                dict.fromkeys(
                    [
                        *initial.context.notices,
                        "diagnosis_and_alternatives_are_limited_to_retrieved_records",
                        "numeric_relaxations_are_capped_by_policy",
                        "relaxed_alternatives_require_user_acceptance",
                        "inventory_and_current_price_remain_unverified",
                        "synthetic_contacts_not_for_contact",
                        "tehran_coverage_incomplete",
                    ]
                )
            ),
        )
    except CatalogRetrievalError as exc:
        messages = {
            "catalog_time_limit": "مهلت جست‌وجوی محدود کاتالوگ تمام شد؛ دوباره تلاش کنید.",
            "catalog_snapshot_changed": "دیتاست تغییر کرد؛ درخواست را از ابتدا تکرار کنید.",
            "catalog_unavailable": "دریافت اطلاعات کاتالوگ ممکن نشد؛ دوباره تلاش کنید.",
            "catalog_invalid_response": "پاسخ کاتالوگ با قرارداد مورد انتظار سازگار نیست.",
        }
        raise RecommendationServiceError(
            exc.code, messages.get(exc.code, "خطای دریافت کاتالوگ."), retryable=exc.retryable
        ) from exc
    except ValidationError as exc:
        raise RecommendationServiceError(
            "invalid_recommendation_data", "دادهٔ جایگزین قابل اعتبارسنجی نیست."
        ) from exc
