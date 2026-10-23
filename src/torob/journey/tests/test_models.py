import json

import pytest
from pydantic import ValidationError

from torob.journey.models import SearchCriteria, ShoppingRequest


def test_criteria_preserve_exact_text_explicit_toman_and_location():
    criteria = SearchCriteria(
        q="  گوشی سامسونگ  ", min_price_toman=10, max_price_toman=20, city="تهران", area="ونک"
    )
    assert criteria.q == "  گوشی سامسونگ  "
    assert json.loads(criteria.model_dump_json()) == criteria.model_dump(mode="json")
    assert criteria.min_price_toman == 10
    with pytest.raises(ValidationError):
        criteria.city = "another city"


@pytest.mark.parametrize("value", [True, False, "100", 1.5, -1, 0, 9_000_000_000_001])
def test_budgets_use_existing_positive_toman_price_limits_without_coercion(value):
    with pytest.raises(ValidationError):
        SearchCriteria(min_price_toman=value)
    with pytest.raises(ValidationError):
        SearchCriteria(max_price_toman=value)


def test_budget_boundaries_and_optional_values():
    assert SearchCriteria(min_price_toman=10, max_price_toman=10).max_price_toman == 10
    assert SearchCriteria().min_price_toman is None
    with pytest.raises(ValidationError):
        SearchCriteria(min_price_toman=20, max_price_toman=10)


def test_identity_extra_fields_and_optional_area_are_not_invented():
    request = ShoppingRequest(request_id="sample-journey")
    assert request.criteria.city is None
    assert request.criteria.area is None
    for values in ({"request_id": " "}, {"request_id": 12}, {"request_id": "id", "ready": True}):
        with pytest.raises(ValidationError):
            ShoppingRequest.model_validate(values)
    with pytest.raises(ValidationError):
        SearchCriteria(area=" ")
