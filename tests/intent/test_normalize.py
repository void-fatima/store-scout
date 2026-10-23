import pytest

from torob.journey.intent.errors import IntentError
from torob.journey.intent.models import Coordinates, IntentFields, IntentRecord
from torob.journey.intent.normalize import parse_money, parse_radius, preference_mode, present


@pytest.mark.parametrize(
    ("text", "value", "currency", "toman"),
    [
        ("۳۰ میلیون تومان", "30000000", "TOMAN", 30_000_000),
        ("٣٠ میلیون تومان", "30000000", "TOMAN", 30_000_000),
        ("400 میلیون ریال", "400000000", "IRR", 40_000_000),
        ("۱٬۲۰۰٬۰۰۰ تومان", "1200000", "TOMAN", 1_200_000),
        ("۱٫۵ میلیون تومن", "1500000.0", "TOMAN", 1_500_000),
        ("چهل میلیون تومان", "40000000", "TOMAN", 40_000_000),
        ("بیست و پنج میلیون تومان", "25000000", "TOMAN", 25_000_000),
        ("100000009.999 ریال", "100000009.999", "IRR", 10_000_000),
        ("۳۰ تومان", "30", "TOMAN", 30),
    ],
)
def test_exact_money_normalization(text, value, currency, toman):
    result = parse_money(text)
    assert (result.value, result.currency, result.toman) == (value, currency, toman)
    assert result.raw_text == text and result.requires_clarification is False


@pytest.mark.parametrize(
    "text", ["۳۰ تومن", "30", "۴۰ میلیون", "قیمت مناسب", "٣٠", "ده بیست تومان"]
)
def test_ambiguous_money_is_never_guessed(text):
    result = parse_money(text)
    assert result.requires_clarification and result.toman is None


@pytest.mark.parametrize(
    "text",
    ["-۳۰ میلیون تومان", "۰ تومان", "۹ ریال", "9000000000001 تومان", "۳۰ تومان ریال", "NaN تومان"],
)
def test_invalid_money_rejected(text):
    with pytest.raises(IntentError):
        parse_money(text)


@pytest.mark.parametrize(
    ("text", "expected"),
    [("۵ کیلومتر", 5.0), ("٥ کیلومتر", 5.0), ("۵۰۰ متر", 0.5), ("2.5 km", 2.5)],
)
def test_radius(text, expected):
    assert parse_radius(text) == expected


@pytest.mark.parametrize("text", ["-۲ کیلومتر", "۰ متر", "۱۰۱ کیلومتر"])
def test_invalid_radius(text):
    with pytest.raises(IntentError):
        parse_radius(text)


def test_radius_requires_unit():
    assert parse_radius("۵") is None


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("ترجیحاً گارانتی", "preferred"),
        ("حتماً گارانتی", "required"),
        ("گارانتی داشته باشه", "ambiguous"),
        ("بدون گارانتی", "unsupported"),
        ("ترجیحاً اقساط", "preferred"),
        ("فقط قسطی", "required"),
    ],
)
def test_purchase_requirement_semantics(text, expected):
    assert preference_mode(text) == expected


def record(**fields):
    return IntentRecord(
        draft_id="a" * 32,
        revision=0,
        expires_at=9999999999,
        fields=IntentFields(**fields),
        provenance={},
    )


def test_missing_information_and_ambiguous_currency_are_visible():
    result = present(record(product_query="گوشی سامسونگ", max_budget="۳۰ تومن", location="صادقیه"))
    assert result.status == "needs_clarification"
    assert {issue.field for issue in result.issues} == {"max_budget", "coordinates", "radius"}
    assert result.criteria.max_budget is None and result.criteria.latitude is None
    assert result.next_question and "۳۰ تومن" in result.next_question


def test_query_annotations_and_soft_preferences_reuse_canonical_models():
    result = present(
        record(
            product_query="Lenovo لپ تاپ",
            brand="Lenovo",
            category="لپ تاپ",
            max_budget="۴۰ میلیون تومان",
            radius="۵ کیلومتر",
            location="ونک",
            coordinates=Coordinates(latitude=35.7, longitude=51.4, for_location="ونک"),
            warranty="ترجیحاً گارانتی",
            installments="ترجیحاً قسطی",
        )
    )
    assert result.status == "awaiting_confirmation" and not result.issues
    assert result.criteria.q == "Lenovo لپ تاپ"
    preferences = result.criteria.preferred_purchase_conditions
    assert preferences.warranty_available is True
    assert preferences.payment_methods == ["installments"]
    assert result.criteria.city is None and result.criteria.area is None
    assert result.criteria.max_budget == 40_000_000


@pytest.mark.parametrize(
    "changes",
    [
        {"min_budget": "۱۰ میلیون تومان"},
        {"warranty": "حتما گارانتی"},
        {"installments": "فقط قسطی"},
        {"other_preferences": ["ارسال رایگان"]},
    ],
)
def test_unsupported_constraints_are_retained_and_block_confirmation(changes):
    result = present(record(product_query="گوشی", max_budget="۳۰ میلیون تومان", **changes))
    assert any(issue.code == "unsupported" for issue in result.issues)
    assert result.status == "needs_clarification"


def test_inconsistent_budget_range_rejected():
    with pytest.raises(IntentError):
        present(
            record(product_query="گوشی", max_budget="۱۰ میلیون تومان", min_budget="۲۰ میلیون تومان")
        )


def test_return_window_preference_uses_existing_contract_without_guarantee():
    result = present(
        record(
            product_query="گوشی",
            max_budget="۳۰ میلیون تومان",
            radius="۵ کیلومتر",
            coordinates=Coordinates(latitude=35.7, longitude=51.4),
            return_window="ترجیحاً ۷ روز مهلت مرجوعی",
        )
    )
    assert not result.issues
    assert result.criteria.preferred_purchase_conditions.return_window_days == 7


def test_required_return_window_cannot_be_silently_relaxed():
    result = present(record(return_window="حتماً ۷ روز مهلت مرجوعی"))
    assert any(
        issue.field == "return_window" and issue.code == "unsupported" for issue in result.issues
    )
