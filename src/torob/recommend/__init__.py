"""Recommendation contracts backed by the authoritative Catalog offer model.

Only models are imported here. Retrieval, ranking and service implementations
are separate tasks and are not required to import or validate these contracts.
"""

from torob.catalog.contracts import OfferCandidate

from .alternative_models import (
    AlternativeDiagnosis,
    AlternativePolicy,
    AlternativesResponse,
    AlternativeSuggestion,
    ConstraintChange,
)
from .followup_models import FollowupPlan, VerificationQuestion
from .models import (
    BeforeVisitVerification,
    CandidateBatch,
    CandidateCoverage,
    DataLimitation,
    ExplanationReason,
    PaymentMethod,
    PriceUnit,
    PurchaseConditions,
    RankingStrategy,
    RecommendationResponse,
    RecommendationResult,
    RetrievalPolicy,
    ScoreBreakdown,
    ShoppingCriteria,
)

__all__ = [
    "AlternativeDiagnosis",
    "AlternativePolicy",
    "AlternativesResponse",
    "AlternativeSuggestion",
    "ConstraintChange",
    "BeforeVisitVerification",
    "CandidateBatch",
    "CandidateCoverage",
    "DataLimitation",
    "ExplanationReason",
    "FollowupPlan",
    "VerificationQuestion",
    "OfferCandidate",
    "PaymentMethod",
    "PriceUnit",
    "PurchaseConditions",
    "RankingStrategy",
    "RecommendationResponse",
    "RecommendationResult",
    "RetrievalPolicy",
    "ScoreBreakdown",
    "ShoppingCriteria",
]
