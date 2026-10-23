import type { AlternativesResponse, PaymentMethod, ShoppingCriteria } from '../../contracts'
import type { ResponseEntry } from '../../journey/operations'
import { recordedNumber, recordedTimestamp } from '../../journey/comparison/recordedValues'
import { ExplanationLimitations, ExplanationReasons } from './ExplanationEvidence'
import { ProposedChanges } from './Alternatives'
import { currencyLabel, exactMoney, offerHash } from './presentation'

const paymentLabels: Record<PaymentMethod, string> = { cash: 'نقدی', card: 'کارت', installments: 'اقساط' }

function SubmittedCriteria({ criteria }: { criteria: ShoppingCriteria }) {
  const preferences = criteria.preferred_purchase_conditions
  return <dl className="product-identity fit-criteria">
    <dt>نام کالای جست‌وجوشده</dt><dd>{criteria.query}</dd>
    <dt>سقف بودجه</dt><dd>{exactMoney(criteria.max_budget)} {currencyLabel(criteria.price_unit)}</dd>
    <dt>شعاع جست‌وجو</dt><dd>{criteria.max_distance_km == null ? 'بدون شعاع مشخص' : `${recordedNumber(criteria.max_distance_km)} کیلومتر`}</dd>
    <dt>محل انتخابی جست‌وجو</dt><dd>عرض: {recordedNumber(criteria.latitude)}؛ طول: {recordedNumber(criteria.longitude)}</dd>
    <dt>زمان خرید درخواستی</dt><dd>{criteria.shopping_time == null ? 'درخواست نشده' : recordedTimestamp(criteria.shopping_time)}</dd>
    <dt>روش پرداخت درخواستی</dt><dd>{preferences?.payment_methods?.length ? preferences.payment_methods.map(method => paymentLabels[method]).join('، ') : 'بدون ترجیح'}</dd>
    <dt>ترجیح گارانتی</dt><dd>{preferences?.warranty_available == null ? 'بدون ترجیح' : preferences.warranty_available ? 'دارای گارانتی' : 'بدون گارانتی'}</dd>
    <dt>مهلت بازگشت درخواستی</dt><dd>{preferences?.return_window_days == null ? 'بدون ترجیح' : `${recordedNumber(preferences.return_window_days)} روز`}</dd>
  </dl>
}

export function ProductFit({ entry, response }: { entry: ResponseEntry; response: AlternativesResponse }) {
  const suggestion = entry.source === 'alternative' ? response.suggestions.find(item => item.result === entry.result
    && item.result.product_id === entry.key.product_id && item.result.offer_id === entry.key.offer_id) : undefined
  if (entry.source === 'alternative' && !suggestion) return <p role="alert">معیار پیشنهادی این جایگزین در نتیجهٔ فعلی در دسترس نیست.</p>
  const criteria = suggestion?.relaxed_constraints ?? response.original_constraints
  return <div className="product-fit">
    <h3>تناسب بر پایهٔ پاسخ سرویس</h3>
    <p>این بخش دلیل‌های سرویس را برای آفر انتخاب‌شده نشان می‌دهد؛ تطبیق واژه‌های عنوان، برند، مدل یا دسته‌بندی، تضمین یکسان بودن مدل یا تناسب فنی نیست.</p>
    {suggestion ? <><p className="uncertainty-note">این جایگزین با معیارهای پیشنهادی زیر بررسی شده است، نه معیارهای اولیه. دیدن این بخش، پذیرش تغییرها نیست.</p>
      <ProposedChanges suggestion={suggestion} /><h3>معیارهای پیشنهادیِ مبنای این جایگزین</h3>
    </> : <h3>معیارهای ارسال‌شدهٔ این جست‌وجو</h3>}
    <SubmittedCriteria criteria={criteria} />
    <p className="muted">ترجیحات بالا درخواست تو هستند، نه تأیید شرایط فروشگاه. سرویس فقط کد صریح روش پرداخت را می‌تواند تطبیق دهد؛ گارانتی و مهلت بازگشت به بررسی نیاز دارند. فاصله، مستقیم است؛ ساعت کاری اعلام‌شده، باز بودن فعلی نیست.</p>
    <h3>سرویس چه دلیل‌هایی برگردانده است؟</h3><ExplanationReasons result={entry.result} />
    <ExplanationLimitations result={entry.result} />
    <p className="uncertainty-note">اطلاعات کافی برای ارزیابی فنی بازی، عکاسی یا برنامه‌نویسی وجود ندارد. عنوان یا مشخصات ثبت‌شده به‌تنهایی چنین تناسبی را ثابت نمی‌کند؛ نیاز دقیق و شواهد فنی معتبر هنوز لازم است.</p>
    {suggestion && <a className="outline-action" href={offerHash('alternative', entry.key)} data-offer-action={offerHash('alternative', entry.key)}>بررسی و پذیرش صریح تغییرهای جایگزین</a>}
  </div>
}
