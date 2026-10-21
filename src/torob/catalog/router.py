from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from torob.catalog.contracts import (
    CatalogContext,
    CatalogPage,
    CatalogQuery,
    ErrorResponse,
    OfferDetail,
    ProductDetail,
    ShopPage,
    ShopQuery,
)
from torob.catalog.repository import CatalogRepository

router = APIRouter(
    prefix="/api/v1/catalog",
    tags=["catalog"],
    responses={
        422: {"model": ErrorResponse, "description": "Unprocessable Content"},
        503: {"model": ErrorResponse},
    },
)


def repository(request: Request) -> CatalogRepository:
    return request.app.state.catalog


Repository = Annotated[CatalogRepository, Depends(repository)]


@router.get("/offers", response_model=CatalogPage)
def search_offers(query: Annotated[CatalogQuery, Query()], repo: Repository):
    """Search recorded offers. A matching shop category alone never creates a candidate."""
    return repo.search(query)


@router.get(
    "/offers/{offer_id}", response_model=OfferDetail, responses={404: {"model": ErrorResponse}}
)
def get_offer(offer_id: str, repo: Repository):
    result = repo.offer(offer_id)
    if result is None:
        raise HTTPException(404, "Offer not found")
    return result


@router.get(
    "/products/{product_id}",
    response_model=ProductDetail,
    responses={404: {"model": ErrorResponse}},
)
def get_product(product_id: str, repo: Repository):
    result = repo.product(product_id)
    if result is None:
        raise HTTPException(404, "Product not found")
    return result


@router.get("/shops", response_model=ShopPage)
def search_shops(query: Annotated[ShopQuery, Query()], repo: Repository):
    """Shop directory/category matches; these do not establish product availability."""
    return repo.shops(query)


@router.get("/meta", response_model=CatalogContext)
def get_metadata(repo: Repository):
    return repo.context()
