# StoreScout | ترب

بخش داده و جست‌وجوی رهام برای هکاتون. بک‌اند مستقل با Python، FastAPI و SQLite FTS5 است.
دیتاست اصلی شامل `shops.csv`، `products.csv` و `offers.csv` مستقیماً از ZIP خوانده می‌شود.
قرارداد `v1` فعلاً **پیش‌نویس برای بازبینی تیم** است.

## اجرای سریع

پیش‌نیاز: Python 3.12 یا بالاتر و [uv](https://docs.astral.sh/uv/getting-started/installation/).
دستورها را از ریشه همین پروژه اجرا کنید؛ روی Windows، PowerShell هم کار می‌کنند.

```powershell
uv sync --locked
uv run store-scout import-data datasets/sample --source-kind sample
uv run store-scout serve --reload
```

- Swagger و آزمایش API: <http://127.0.0.1:8000/docs>
- سلامت سرویس: <http://127.0.0.1:8000/health>
- جست‌وجو: <http://127.0.0.1:8000/api/v1/catalog/offers?q=گوشی>
- اگر دیتابیس از قبل داده دارد، برای جایگزینی آگاهانه `--replace` اضافه کنید.
- دادهٔ نمونه کاملاً ساختگی است و در پاسخ‌ها با `source_kind=sample` مشخص می‌شود.

برای فایل اصلی در سیستم رهام:

```powershell
uv run store-scout import-data "C:\Users\asus\Desktop\torob-dataset.zip" --replace --allow-invalid
```

همین دستور روی هر مسیر ZIP یا پوشه‌ای با سه CSV اصلی کار می‌کند. فایل اصلی، دیتابیس و گزارش‌های
اجرای محلی وارد Git نمی‌شوند. گزارش اعتبارسنجی در `var/reports/latest-import.json` است.
بدون uv: یک virtualenv بسازید، `python -m pip install -e .` و سپس `store-scout ...` اجرا کنید.

## ساختار پروژه

خلاصهٔ بررسی فایل اصلی و دلیل استفاده از `--allow-invalid` در
[گزارش کیفیت دیتاست](docs/DATA_QUALITY_FA.md) ثبت شده است.
پس از ورود داده، برای کار روزمره فقط `uv run store-scout serve --reload` کافی است.

| مسیر | کار |
| --- | --- |
| `src/torob/catalog/` | قرارداد داده، API خواندن، جست‌وجو و فاصله |
| `src/torob/data/` | خواندن CSV/ZIP، اعتبارسنجی و دیتابیس |
| `src/torob/api.py` | ساخت برنامه و ثبت routeها |
| `contracts/` | قرارداد API، schemaها و نمونهٔ پاسخ‌ها |

شرح endpointها و معنای فیلدها در [قرارداد API](contracts/README.md) آمده است.

## بررسی کیفیت کد

```powershell
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run python scripts/export_contracts.py --check
```

تست‌ها با دیتابیس موقت و نمونهٔ کوچک اجرا می‌شوند و به ZIP اصلی یا اینترنت نیاز ندارند.
`uv.lock` نسخهٔ وابستگی‌ها را تثبیت می‌کند؛ به‌روزرسانی وابستگی‌ها را جداگانه بازبینی کنید.

برای بررسی API در حال اجرا، `uv run python scripts/smoke_catalog.py` را در ترمینال دوم
اجرا کنید. [نتیجهٔ بررسی نسخهٔ اولیه](docs/VERIFICATION_FA.md) ثبت شده است.

## محدوده نسخه فعلی

- ورود جریانی داده، کنترل شناسه و ارتباط‌ها، گزارش کیفیت و جایگزینی اتمی دیتاست.
- جست‌وجوی فارسی با یکسان‌سازی حروف عربی/فارسی، ارقام، اعراب و نیم‌فاصله.
- فیلتر قیمت به تومان، محصول، فروشگاه، دستهٔ محصول و فاصلهٔ مستقیم جغرافیایی؛ صفحه‌بندی.
- تفکیک آفر ثبت‌شده از فروشگاه دارای دستهٔ فعالیت؛ اطلاعات ساعت کاری و شرایط پرداخت حفظ می‌شوند.
- پیشنهاد هوشمند، استخراج نیاز از متن آزاد، UI و دیپلوی هنوز بخش‌های بعدی تیم هستند.
- `last_price_changed_at` زمان تغییر قیمت است؛ زمان تأیید موجودی یا آخرین بررسی فروشنده نیست.
- نام فروشگاه‌ها ساختگی یا تأییدنشده و شماره‌های تماس دیتاست ساختگی هستند. موجودی همیشه
  `unconfirmed` است؛ هیچ تماس یا پیگیری واقعی انجام نمی‌شود.

SQLite برای توسعهٔ محلی و یک نمونهٔ سرویس با دیسک پایدار انتخاب شده است. برای چند replica یا
فایل‌سیستم موقت، لایهٔ repository و ذخیره‌سازی باید پیش از دیپلوی متناسب شوند.

مراجع پیاده‌سازی: [FastAPI query models](https://fastapi.tiangolo.com/tutorial/query-param-models/)،
[FastAPI lifespan tests](https://fastapi.tiangolo.com/advanced/testing-events/)،
[Python sqlite3](https://docs.python.org/3/library/sqlite3.html).
