"""Bounded Catalog retrieval with coherent snapshots and explicit failures."""

import math
from typing import Any, Protocol

from pydantic import ValidationError

from torob.catalog.contracts import CONTRACT_VERSION, CatalogPage, CatalogQuery

from .models import CandidateBatch, CandidateCoverage, RetrievalPolicy, ShoppingCriteria


class CatalogSource(Protocol):
    def search(self, query: CatalogQuery) -> CatalogPage: ...


class CatalogHTTPResponse(Protocol):
    def raise_for_status(self) -> Any: ...

    def json(self) -> Any: ...


class CatalogHTTPTransport(Protocol):
    def get(self, path: str, *, params: dict[str, Any], timeout: float) -> CatalogHTTPResponse: ...


class CatalogRetrievalError(ValueError):
    code = "catalog_invalid_response"
    retryable = False


class CatalogUnavailable(CatalogRetrievalError):
    code = "catalog_unavailable"
    retryable = True


class CatalogSnapshotChanged(CatalogRetrievalError):
    """The entire batch is discarded; callers may explicitly retry."""

    code = "catalog_snapshot_changed"
    retryable = True


class CatalogAPIClient:
    """Inject a synchronous HTTP transport; no httpx production dependency."""

    def __init__(self, transport: CatalogHTTPTransport, *, timeout_seconds: float = 5.0):
        if (
            isinstance(timeout_seconds, bool)
            or not isinstance(timeout_seconds, (int, float))
            or not math.isfinite(timeout_seconds)
            or not 0 < timeout_seconds <= 30
        ):
            raise ValueError("timeout_seconds must be finite and in (0, 30]")
        self.transport = transport
        self.timeout_seconds = float(timeout_seconds)

    def search(self, query: CatalogQuery) -> CatalogPage:
        try:
            response = self.transport.get(
                "/api/v1/catalog/offers",
                params=query.model_dump(mode="json", exclude_none=True),
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except Exception as exc:
            raise CatalogUnavailable("Catalog HTTP request failed") from exc
        try:
            return CatalogPage.model_validate(response.json())
        except (ValueError, TypeError) as exc:
            raise CatalogRetrievalError("Catalog returned malformed JSON or payload") from exc


def retrieve_candidates(
    source: CatalogSource,
    criteria: ShoppingCriteria,
    policy: RetrievalPolicy | None = None,
) -> CandidateBatch:
    criteria = ShoppingCriteria.model_validate(criteria.model_dump())
    policy = RetrievalPolicy.model_validate((policy or RetrievalPolicy()).model_dump())
    base_query = CatalogQuery(
        q=criteria.query,
        max_price_toman=criteria.budget_toman,
        lat=criteria.latitude,
        lon=criteria.longitude,
        radius_km=criteria.max_distance_km,
        sort="price_asc",
        page_size=policy.page_size,
    )
    candidates = []
    seen = set()
    first_page = None
    previous_key = None
    for page_number in range(1, policy.max_pages + 1):
        query = CatalogQuery.model_validate(base_query.model_dump() | {"page": page_number})
        try:
            response = source.search(query)
        except CatalogRetrievalError:
            raise
        except Exception as exc:
            raise CatalogUnavailable("Catalog source failed") from exc
        try:
            if not isinstance(response, CatalogPage):
                raise CatalogRetrievalError("Source must return the canonical CatalogPage")
            page = CatalogPage.model_validate(response.model_dump())
        except ValidationError as exc:
            raise CatalogRetrievalError("Catalog page failed schema validation") from exc
        if page.context.contract_version != CONTRACT_VERSION:
            raise CatalogRetrievalError("Unsupported Catalog contract version")
        if page.page != page_number or page.page_size != policy.page_size or page.total < 0:
            raise CatalogRetrievalError("Catalog returned inconsistent pagination metadata")
        if first_page is None:
            first_page = page
        elif page.context != first_page.context:
            raise CatalogSnapshotChanged("Catalog context changed between pages")
        if page.total != first_page.total:
            raise CatalogRetrievalError("Catalog total changed during pagination")
        expected_size = min(policy.page_size, max(0, page.total - len(candidates)))
        expected_next = page_number * policy.page_size < page.total
        if len(page.items) != expected_size or page.has_next != expected_next:
            raise CatalogRetrievalError("Catalog page size/has_next does not match total")
        if page.total and page.context.dataset is None:
            raise CatalogRetrievalError("Nonempty Catalog page has no dataset provenance")
        for candidate in page.items:
            if candidate.offer_id in seen:
                raise CatalogRetrievalError("Duplicate offer_id across Catalog pages")
            if candidate.distance_km is not None and (
                not math.isfinite(candidate.distance_km) or candidate.distance_km < 0
            ):
                raise CatalogRetrievalError("Invalid recorded distance")
            key = (
                candidate.price_toman is None,
                candidate.price_toman or 0,
                candidate.offer_id,
            )
            if previous_key is not None and key < previous_key:
                raise CatalogRetrievalError("Catalog did not honor price_asc ordering")
            previous_key = key
            seen.add(candidate.offer_id)
            candidates.append(candidate)
        if not page.has_next:
            break
    assert first_page is not None  # max_pages >= 1 by contract.
    complete = len(candidates) == first_page.total
    try:
        return CandidateBatch(
            candidates=candidates,
            context=first_page.context,
            coverage=CandidateCoverage(
                query=base_query,
                pages_fetched=page_number,
                retrieved_count=len(candidates),
                catalog_total=first_page.total,
                complete_for_query=complete,
                stop_reason="exhausted" if complete else "page_limit",
            ),
        )
    except ValidationError as exc:
        raise CatalogRetrievalError("Candidate batch failed validation") from exc
