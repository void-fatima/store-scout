"""Fixed public errors. Raw model output, input and credentials are never diagnostics."""

from torob.catalog.contracts import ErrorDetail, ErrorResponse

_ERRORS = {
    "invalid_intent_request": (422, "اطلاعات درخواست یا نسخهٔ پیش‌نویس معتبر نیست."),
    "invalid_interpretation": (502, "پاسخ مدل معتبر نبود؛ هیچ جست‌وجویی انجام نشد."),
    "invalid_criteria": (422, "مقدار معیارها معتبر نیست؛ پیش‌نویس قبلی حفظ شد."),
    "intent_not_found": (404, "پیش‌نویس در دسترس نیست یا منقضی شده است."),
    "stale_intent": (409, "پیش‌نویس تغییر کرده است؛ نسخهٔ فعلی را دوباره بررسی کنید."),
    "confirmation_required": (409, "فقط پیش‌نویس کامل و تأییدشده قابل جست‌وجو است."),
    "intent_rate_limit": (429, "سقف درخواست‌های تفسیر رسیده است؛ بعداً تلاش کنید."),
    "intent_capacity": (503, "ظرفیت پیش‌نویس‌ها تکمیل است؛ بعداً تلاش کنید."),
    "intent_unavailable": (503, "سرویس تفسیر فعلاً در دسترس نیست."),
    "request_too_large": (413, "حجم درخواست بیشتر از حد مجاز است."),
}


class IntentError(Exception):
    def __init__(self, code: str):
        self.status, message = _ERRORS[code]
        self.response = ErrorResponse(error=ErrorDetail(code=code, message=message))
        super().__init__(message)
