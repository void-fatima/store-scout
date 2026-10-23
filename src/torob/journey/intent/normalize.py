"""Deterministic Persian money/radius normalization and canonical Journey preparation."""

import re
import unicodedata
from decimal import Decimal

from pydantic import ValidationError

from torob.catalog.text import normalize_text
from torob.journey.adapter import JourneyRequestError, adapt_criteria
from torob.journey.models import SearchCriteria

from .errors import IntentError
from .models import IntentRecord, IntentView, Issue, Money, SummaryLine

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩يك", "01234567890123456789یک")
_SMALL = {
    "صفر": 0,
    "یک": 1,
    "دو": 2,
    "سه": 3,
    "چهار": 4,
    "پنج": 5,
    "شش": 6,
    "هفت": 7,
    "هشت": 8,
    "نه": 9,
    "ده": 10,
    "یازده": 11,
    "دوازده": 12,
    "سیزده": 13,
    "چهارده": 14,
    "پانزده": 15,
    "شانزده": 16,
    "هفده": 17,
    "هجده": 18,
    "نوزده": 19,
    "بیست": 20,
    "سی": 30,
    "چهل": 40,
    "پنجاه": 50,
    "شصت": 60,
    "هفتاد": 70,
    "هشتاد": 80,
    "نود": 90,
    "صد": 100,
    "دویست": 200,
    "سیصد": 300,
    "چهارصد": 400,
    "پانصد": 500,
    "ششصد": 600,
    "هفتصد": 700,
    "هشتصد": 800,
    "نهصد": 900,
}


def readable(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).translate(_DIGITS)
    value = value.replace("\u200c", " ").replace("٫", ".").replace("٬", ",")
    return " ".join(value.split())


def _number(value: str) -> Decimal | None:
    if re.fullmatch(r"(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]{1,6})?", value):
        return Decimal(value.replace(",", ""))
    parts = value.split(" و ")
    if parts and all(part in _SMALL for part in parts):
        numbers = [_SMALL[part] for part in parts]
        for previous, following in zip(numbers, numbers[1:], strict=False):
            if not (
                (previous >= 100 and previous % 100 == 0 and following < 100)
                or (20 <= previous <= 90 and previous % 10 == 0 and following < 10)
            ):
                return None
        return Decimal(sum(numbers))
    return None


def parse_money(raw: str) -> Money:
    text = readable(raw)
    if any(sign in text for sign in ("-", "−", "+")):
        raise IntentError("invalid_criteria")
    units = [unit for unit in ("تومان", "تومن", "ریال") if unit in text]
    if len(units) > 1:
        raise IntentError("invalid_criteria")
    currency = "IRR" if units == ["ریال"] else "TOMAN" if units else None
    text = re.sub(r"^(?:تا|حداکثر|حداقل|از|زیر|سقف|بودجه)\s+", "", text)
    for unit in units:
        text = text.replace(unit, "").strip()
    if text.casefold() in {"nan", "inf", "infinity", "∞"}:
        raise IntentError("invalid_criteria")
    scale = 1
    for word, multiplier in (("میلیارد", 1_000_000_000), ("میلیون", 1_000_000), ("هزار", 1000)):
        if text.endswith(word):
            text, scale = text[: -len(word)].strip(), multiplier
            break
    number = _number(text)
    if number is None:
        return Money(
            raw_text=raw, value=None, currency=currency, toman=None, requires_clarification=True
        )
    number *= scale
    limit = 90_000_000_000_000 if currency == "IRR" else 9_000_000_000_000
    if not number.is_finite() or number <= 0 or number > limit:
        raise IntentError("invalid_criteria")
    if units == ["تومن"] and scale == 1 and number < 1000:
        return Money(
            raw_text=raw, value=None, currency=None, toman=None, requires_clarification=True
        )
    toman = int(number) // 10 if currency == "IRR" else int(number) if currency else None
    if toman is not None and toman < 1:
        raise IntentError("invalid_criteria")
    return Money(
        raw_text=raw,
        value=format(number, "f"),
        currency=currency,
        toman=toman,
        requires_clarification=currency is None,
    )


def parse_radius(raw: str) -> float | None:
    text = readable(raw)
    if any(sign in text for sign in ("-", "−", "+")):
        raise IntentError("invalid_criteria")
    text = re.sub(r"^(?:شعاع|فاصله|تا|حداکثر)\s+", "", text)
    match = re.fullmatch(r"(.+?)\s*(کیلومتر|کیلومتری|km|متر|متری|m)", text, flags=re.I)
    if not match:
        return None
    number = _number(match[1].strip())
    if number is None:
        return None
    if match[2].casefold() in {"متر", "متری", "m"}:
        number /= 1000
    if not 0 < number <= 100:
        raise IntentError("invalid_criteria")
    return float(number)


def preference_mode(raw: str) -> str:
    tokens = set(normalize_text(raw).split())
    if tokens & {"بدون", "نمیخوام", "نباشه"}:
        return "unsupported"
    if tokens & {"الزامی", "حتما", "باید", "فقط", "ضروری"}:
        return "required"
    if tokens & {"ترجیح", "ترجیحا", "ترجیحاً", "بهتره", "ترجیحی"}:
        return "preferred"
    return "ambiguous"


def present(record: IntentRecord) -> IntentView:
    fields = record.fields
    issues = []
    summary = []

    def issue(field, code, question):
        issues.append(Issue(field=field, code=code, question=question))

    def line(label, value):
        summary.append(SummaryLine(label=label, value=value))

    if not record.shopping_related:
        issue("product_query", "irrelevant", "چه کالایی برای خرید در نظر داری؟")
    if not fields.product_query:
        issue("product_query", "missing", "دنبال چه کالایی می‌گردی؟")
    terms = [fields.product_query] if fields.product_query else []
    for annotation in (fields.brand, fields.category):
        if annotation and normalize_text(annotation) not in normalize_text(" ".join(terms)):
            terms.append(annotation)
    query = readable(" ".join(terms)) or None
    if query:
        if not normalize_text(query):
            raise IntentError("invalid_criteria")
        line("عبارت جست‌وجو", query)
    if fields.brand:
        line("برند در عبارت جست‌وجو", fields.brand)
    if fields.category:
        line("دسته در عبارت جست‌وجو", fields.category)

    maximum = parse_money(fields.max_budget) if fields.max_budget else None
    minimum = parse_money(fields.min_budget) if fields.min_budget else None
    for name, money, title in (
        ("max_budget", maximum, "سقف بودجه"),
        ("min_budget", minimum, "کف بودجه"),
    ):
        if money is None:
            if name == "max_budget":
                issue(name, "missing", "سقف بودجه چقدر است؟ مبلغ و واحد تومان یا ریال را مشخص کن.")
            continue
        if money.requires_clarification:
            issue(
                name,
                "ambiguous",
                f"منظورت از «{money.raw_text}» چه مبلغی است؟ "
                "مقدار کامل و تومان یا ریال را مشخص کن.",
            )
            line(title, f"{money.raw_text} (نیازمند توضیح)")
        else:
            line(title, f"{money.value} {money.currency} — {money.toman:,} تومان")
    if minimum:
        issue(
            "min_budget",
            "unsupported",
            "جست‌وجوی پیشنهادها فعلاً کف بودجه را اعمال نمی‌کند؛ برای ادامه باید آن را صریحاً حذف کنی.",
        )
    if maximum and minimum and maximum.toman is not None and minimum.toman is not None:
        if minimum.toman > maximum.toman:
            raise IntentError("invalid_criteria")

    coords = fields.coordinates
    if fields.location:
        line("محدودهٔ درخواستی", fields.location)
    if coords is None or (fields.location and coords.for_location != fields.location):
        issue(
            "coordinates",
            "resolution_required",
            "نقطهٔ موردنظر را روی نقشه مشخص کن؛ نام محله به مختصات تبدیل نمی‌شود.",
        )
        coords = None
    if coords:
        line("نقطهٔ انتخابی کاربر", f"{coords.latitude}, {coords.longitude}")
    radius = parse_radius(fields.radius) if fields.radius else None
    if radius is None:
        issue(
            "radius",
            "ambiguous" if fields.radius else "missing",
            "شعاع جست‌وجو چند کیلومتر یا متر باشد؟",
        )
    else:
        line("شعاع جست‌وجو", f"{radius:g} کیلومتر")

    preferences = {}
    for name, title in (
        ("warranty", "گارانتی"),
        ("installments", "خرید قسطی"),
        ("return_window", "مهلت مرجوعی"),
    ):
        raw = getattr(fields, name)
        if raw is None:
            continue
        mode = preference_mode(raw)
        line(
            title,
            f"{raw} ({'ترجیح؛ نیازمند بررسی فروشگاه' if mode == 'preferred' else 'تأییدنشده'})",
        )
        if mode == "preferred":
            if name == "return_window":
                days = re.search(r"([0-9]+)\s*روز", readable(raw))
                if any(sign in raw for sign in ("-", "−")):
                    raise IntentError("invalid_criteria")
                if days is None:
                    issue(name, "ambiguous", "مهلت مرجوعی ترجیحی چند روز باشد؟")
                else:
                    preferences["return_window_days"] = int(days[1])
            else:
                preferences.update(
                    {"warranty_available": True}
                    if name == "warranty"
                    else {"payment_methods": ["installments"]}
                )
        elif mode == "ambiguous":
            issue(name, "ambiguous", f"{title} الزام است یا فقط ترجیح می‌دهی؟")
        else:
            issue(
                name,
                "unsupported",
                f"الزام یا حذف قطعی {title} قابل اعمال نیست؛ "
                "آن را صریحاً به ترجیح تغییر بده یا حذف کن.",
            )
    if fields.other_preferences:
        issue(
            "other_preferences",
            "unsupported",
            "شرط‌های دیگر فعلاً قابل اعمال نیستند؛ برای ادامه باید صریحاً حذف شوند.",
        )
        line("شرط‌های پشتیبانی‌نشده", "؛ ".join(fields.other_preferences))
    criteria_data = {
        "q": query,
        "max_budget": maximum.value if maximum and not maximum.requires_clarification else None,
        "price_unit": maximum.currency if maximum and not maximum.requires_clarification else None,
        "latitude": coords.latitude if coords else None,
        "longitude": coords.longitude if coords else None,
        "max_distance_km": radius if coords else None,
        "preferred_purchase_conditions": preferences or None,
    }
    invalid = False
    try:
        criteria = SearchCriteria.model_validate(criteria_data)
        if not issues:
            adapt_criteria(criteria)
    except (ValidationError, JourneyRequestError):
        invalid = True
    if invalid:
        raise IntentError("invalid_criteria")
    status = (
        record.decision
        if record.decision != "pending"
        else "invalid"
        if not record.shopping_related
        else "needs_clarification"
        if issues
        else "awaiting_confirmation"
    )
    return IntentView(
        draft_id=record.draft_id,
        revision=record.revision,
        expires_at=record.expires_at,
        status=status,
        fields=fields,
        provenance=record.provenance,
        max_budget=maximum,
        min_budget=minimum,
        criteria=criteria,
        issues=issues,
        next_question=issues[0].question if issues else None,
        summary=summary,
        notices=[
            "تفسیر مدل تا تأیید صریح کاربر قطعی نیست.",
            "برند و دسته فقط در عبارت جست‌وجو هستند؛ فیلتر قطعی برند یا دسته نیستند.",
            "گارانتی و اقساط فقط ترجیح‌اند؛ وجودشان باید از فروشگاه بررسی شود.",
            "نتیجه فقط از کاتالوگ می‌آید؛ قیمت و موجودی زنده تأیید نشده‌اند.",
        ],
    )
