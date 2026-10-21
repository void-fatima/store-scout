# نتیجهٔ بررسی نسخهٔ اولیه

بررسی محلی در ۲۱ اکتبر ۲۰۲۶ روی Windows و Python 3.13 انجام شد.
مسیر بررسی: درخواست HTTP به API → اعتبارسنجی پارامترها → جست‌وجوی SQLite روی دیتاست
واردشده → پاسخ مطابق قرارداد. رابط محصول هنوز پیاده‌سازی نشده است؛ دریافت
HTML صفحهٔ Swagger بررسی شد، اما آزمون مرورگری UI محصول انجام نشده است.

| بررسی | نتیجه |
| --- | --- |
| تست‌های واحد و یکپارچه | 56 passed |
| Ruff lint و formatting | پاس |
| تطابق OpenAPI، schema و نمونهٔ پاسخ با کد | پاس |
| ساخت wheel و source distribution | پاس |
| `PRAGMA quick_check` | `ok` |
| `PRAGMA foreign_key_check` | بدون مورد |
| درخواست‌های واقعی HTTP | 11 بررسی پاس |

درخواست‌ها شامل سلامت و آمادگی داده، Swagger/OpenAPI، جست‌وجو، جزئیات آفر و محصول،
بودجه، شعاع جغرافیایی، دستهٔ فروشگاه و خطاهای 422/404 بودند. پاسخ‌ها با مدل قرارداد
اعتبارسنجی شدند. دادهٔ فعال: 6476 فروشگاه، 225901 محصول، 331382 آفر.

در یک اجرای محلی، دریافت صفحهٔ اول حدود 16ms، جست‌وجوی گوشی با سقف بودجه حدود 127ms و
جست‌وجوی فاصله در شعاع ۵ کیلومتر حدود 891ms طول کشید. این‌ها یک اندازه‌گیری محلی هستند،
نه تعهد کارایی در محیط استقرار یا آزمون بار.

تست‌ها یک هشدار deprecation از ترکیب Starlette TestClient و httpx داشتند؛ تستی شکست نخورد.
فایل GitHub Actions برای Ubuntu/Python 3.12 و Windows/Python 3.13 آماده شده است؛ اجرای
آن روی GitHub هنوز انجام نشده است.

بازاجرا:

```powershell
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run python scripts/export_contracts.py --check
uv build
```

با سرور روشن در ترمینال دیگر:

```powershell
uv run python scripts/smoke_catalog.py
```

گزارش اجرای HTTP در `var/reports/latest-smoke.json` ذخیره می‌شود.
