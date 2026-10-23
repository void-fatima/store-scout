import type { RecommendationPanelProps } from '../../contracts'
import type { ResponseEntry } from '../../journey/operations'
import { recordedHours, recordedNumber, recordedPayments, recordedText } from '../../journey/comparison/recordedValues'
import { Icon } from '../../shell/Icon'
import { OfferCard } from './OfferCard'
import { currencyLabel, exactMoney } from './presentation'

export function Explanation({ entry, rank, response, selected, onToggle, selectionDisabled }: {
  entry: ResponseEntry; rank: number; response: NonNullable<RecommendationPanelProps['response']>
  selected: boolean; onToggle: NonNullable<Parameters<typeof OfferCard>[0]['onToggle']>
  selectionDisabled: boolean
}) {
  const result = entry.result
  const { candidate } = result
  const criteria = response.original_constraints
  return <>
    <a className="detail-back" href="#results"><Icon name="arrow" />بازگشت به پیشنهادها</a>
    <div className="detail-heading">
      <h2 id="recommendation-title" tabIndex={-1}>چرا این پیشنهاد برای تو مناسب است؟</h2>
      <p>دلیل‌ها بر پایهٔ اطلاعات ثبت‌شده‌اند؛ رتبه‌بندی در میان آفرهای بازیابی‌شده است.</p>
    </div>
    <div className="detail-grid">
      <OfferCard result={result} entry={entry} rank={rank} selected={selected} onToggle={onToggle} selectionDisabled={selectionDisabled} detail />
      <section className="detail-surface" aria-labelledby="explanation-heading">
        <h3 id="explanation-heading">انتخابی با دلیل روشن</h3>
        <ol className="explanation-list">{result.explanation_reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>
          <Icon name="bulb" /><p>{reason.message}</p>
        </li>)}</ol>
        <p className="explanation-budget">سقف بودجهٔ جست‌وجو: {exactMoney(criteria.max_budget)} {currencyLabel(criteria.price_unit)}</p>
        <h3>چه چیزهایی هنوز مشخص نیست؟</h3>
        <ul className="limitations-list">{result.data_limitations.map((limitation, index) => <li key={`${limitation.code}-${index}`}>{limitation.message}</li>)}</ul>
        <p className="uncertainty-note">موجودی و قیمت فعلی تأیید نشده‌اند. زمان تغییر قیمت، زمان تأیید نیست. پیش از مراجعه، شرایط خرید را بررسی کن.</p>
        <details className="offer-record-details"><summary>اطلاعات ثبت‌شده و شناسه‌های این آفر</summary>
          <dl>
            <dt>شناسهٔ داده</dt><dd><bdi>{entry.key.dataset_id}</bdi></dd>
            <dt>شناسهٔ کالا</dt><dd><bdi>{entry.key.product_id}</bdi></dd>
            <dt>شناسهٔ آفر</dt><dd><bdi>{entry.key.offer_id}</bdi></dd>
            <dt>شناسهٔ فروشگاه</dt><dd><bdi>{result.shop_id}</bdi></dd>
            <dt>عنوان فروشنده</dt><dd>{recordedText(candidate.seller_title)}</dd>
            <dt>توضیح ثبت‌شده</dt><dd>{recordedText(candidate.description)}</dd>
            <dt>نشانی</dt><dd>{recordedText(candidate.shop.address)}</dd>
            <dt>مختصات ثبت‌شده</dt><dd>{recordedNumber(candidate.shop.lat)}، {recordedNumber(candidate.shop.lon)}</dd>
            <dt>پرداخت</dt><dd>{recordedPayments(candidate.shop.payment_options)}</dd>
            <dt>گارانتی ثبت‌شده</dt><dd>{recordedText(candidate.warranty)}؛ تأیید نشده</dd>
            <dt>سیاست بازگشت فروشگاه</dt><dd>نامشخص</dd>
            <dt>ساعت کاری اعلام‌شده</dt><dd><ul>{recordedHours(candidate.shop.weekly_hours).map(day => <li key={day.day}>{day.label}: {day.hours}</li>)}</ul><p>ساعت‌ها تأیید نشده‌اند؛ باز بودن فعلی فروشگاه مشخص نیست.</p></dd>
          </dl>
        </details>
        <a className="outline-action" href="#results">بازگشت به پیشنهادها</a>
      </section>
    </div>
  </>
}
