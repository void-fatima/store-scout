"""Recommendation composition and structured failures; no API routes are changed."""

from typing import Any

from pydantic import BaseModel, ValidationError

from torob.catalog.contracts import ErrorDetail, ErrorResponse

from .catalog import CatalogRetrievalError, CatalogSource, retrieve_candidates
from .models import RankingStrategy, RecommendationResponse, RetrievalPolicy, ShoppingCriteria
from .ranking import rank_candidates


class RecommendationServiceError(Exception):
    """Public canonical error payload; raw upstream descriptions/errors stay private."""

    def __init__(self, code: str, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.response = ErrorResponse(
            error=ErrorDetail(code=code, message=message, details=[{"retryable": retryable}])
        )
        self.retryable = retryable


def _input(value: Any) -> Any:
    return value.model_dump() if isinstance(value, BaseModel) else value


def recommend(
    source: CatalogSource,
    criteria: ShoppingCriteria | dict[str, Any],
    *,
    retrieval: RetrievalPolicy | dict[str, Any] | None = None,
    strategy: RankingStrategy | dict[str, Any] | None = None,
) -> RecommendationResponse:
    try:
        criteria = ShoppingCriteria.model_validate(_input(criteria))
        retrieval = RetrievalPolicy.model_validate(
            _input(retrieval) if retrieval is not None else {}
        )
        strategy = RankingStrategy.model_validate(_input(strategy) if strategy is not None else {})
    except ValidationError as exc:
        raise RecommendationServiceError(
            "invalid_recommendation_input", "ورودی درخواست پیشنهاد معتبر نیست."
        ) from exc
    try:
        batch = retrieve_candidates(source, criteria, retrieval)
    except CatalogRetrievalError as exc:
        messages = {
            "catalog_unavailable": "دریافت اطلاعات کاتالوگ ممکن نشد؛ دوباره تلاش کنید.",
            "catalog_snapshot_changed": "دیتاست تغییر کرد؛ درخواست را از ابتدا تکرار کنید.",
            "catalog_invalid_response": "پاسخ کاتالوگ با قرارداد مورد انتظار سازگار نیست.",
        }
        raise RecommendationServiceError(
            exc.code, messages[exc.code], retryable=exc.retryable
        ) from exc
    try:
        return rank_candidates(criteria, batch, strategy)
    except ValidationError as exc:
        raise RecommendationServiceError(
            "invalid_recommendation_data", "دادهٔ لازم برای پیشنهاد قابل اعتبارسنجی نیست."
        ) from exc
