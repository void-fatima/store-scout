import { useRef } from 'react'
import type { ReactNode } from 'react'
import type { AlternativesResponse, ComparisonKey, RecommendationPanelProps } from '../../contracts'
import { responseEntries, sameValue } from '../operations'
import type { ResponseEntry } from '../operations'
import { recordedHours, recordedNumber, recordedPayments, recordedText, recordedTimestamp, unknown } from './recordedValues'

type Props = {
  response: AlternativesResponse | null
  selections: readonly ComparisonKey[]
  status: RecommendationPanelProps['status']
  onComparisonChange: RecommendationPanelProps['onComparisonChange']
}

function RecordedHours({ entry }: { entry: ResponseEntry }) {
  return <>
    <ul className="comparison-hours">{recordedHours(entry.result.candidate.shop.weekly_hours).map(day =>
      <li key={day.day}>{day.label}: <bdi>{day.hours}</bdi></li>)}</ul>
    <p className="muted">ساعات ثبت‌شده، باز بودن واقعی فروشگاه را تأیید نمی‌کنند.</p>
  </>
}

const rows: readonly { label: string; value: (entry: ResponseEntry) => ReactNode }[] = [
  { label: 'شناسهٔ کالا', value: ({ result }) => <bdi>{result.product_id}</bdi> },
  { label: 'برند و مدل', value: ({ result }) => <>{recordedText(result.candidate.product.brand_name)} / {recordedText(result.candidate.product.model)}</> },
  { label: 'دستهٔ کالا', value: ({ result }) => recordedText(result.candidate.product.category_name) },
  { label: 'قیمت ثبت‌شده', value: ({ result }) => result.candidate.price_toman == null
    ? `${unknown}؛ واحد قیمت‌های ثبت‌شده: تومان` : `${recordedNumber(result.candidate.price_toman)} تومان` },
  { label: 'فروشگاه', value: ({ result }) => <>{result.candidate.shop.name}<br />شناسه: <bdi>{result.shop_id}</bdi><br />هویت ساختگی یا تأییدنشده</> },
  { label: 'عنوان و توضیح ثبت‌شدهٔ فروشنده', value: ({ result }) => <>{recordedText(result.candidate.seller_title)}<br />{recordedText(result.candidate.description)}</> },
  { label: 'نشانی ثبت‌شده', value: ({ result }) => <>{recordedText(result.candidate.shop.address)}<br />محدوده: {recordedText(result.candidate.shop.location_label)}</> },
  { label: 'مختصات فروشگاه', value: ({ result }) => <>عرض: <bdi>{recordedNumber(result.candidate.shop.lat)}</bdi><br />طول: <bdi>{recordedNumber(result.candidate.shop.lon)}</bdi></> },
  { label: 'فاصلهٔ مستقیم', value: ({ result }) => result.candidate.distance_km == null ? unknown : `${recordedNumber(result.candidate.distance_km)} کیلومتر (مستقیم)` },
  { label: 'موجودی', value: () => 'تأییدنشده؛ پیش از مراجعه بررسی کنید.' },
  { label: 'ساعات کاری ثبت‌شده', value: entry => <RecordedHours entry={entry} /> },
  { label: 'روش‌های پرداخت ثبت‌شده', value: ({ result }) => recordedPayments(result.candidate.shop.payment_options) },
  { label: 'گارانتی ثبت‌شده', value: ({ result }) => result.candidate.warranty?.trim() ? `${result.candidate.warranty} (تأییدنشده)` : unknown },
  // The schema contains requested return preferences, not a seller return policy.
  { label: 'شرایط بازگشت کالا', value: () => unknown },
  { label: 'آخرین تغییر قیمت', value: ({ result }) => <>{recordedTimestamp(result.candidate.last_price_changed_at)}<br />زمان تغییر، زمان تأیید قیمت یا موجودی نیست.</> },
  { label: 'نوع نتیجه', value: ({ source }) => source === 'original' ? 'از نتایج جست‌وجوی فعلی؛ موجودی تأیید نشده است.' : 'از جایگزین‌ها؛ با معیارهای اولیه تأیید نشده و نیازمند پذیرش تغییرهاست.' },
]

export function ComparisonView({ response, selections, status, onComparisonChange }: Props) {
  const heading = useRef<HTMLHeadingElement>(null)
  const tableRegion = useRef<HTMLDivElement>(null)
  // No cached comparison data: every render resolves the current snapshot's keys.
  const available = status === 'ready' && response ? responseEntries(response) : []
  const resolved = selections.map(key => available.find(entry => sameValue(entry.key, key)) ?? null)
  const entries = resolved.filter((entry): entry is ResponseEntry => entry !== null)
  const missing = resolved.length - entries.length
  const dataset = entries.length ? response?.original.context.dataset : null

  function remove(key: ComparisonKey) {
    // Delegate every mutation (including stale-key cleanup) to the existing validator.
    onComparisonChange(entries.filter(entry => !sameValue(entry.key, key)).map(entry => entry.key))
    requestAnimationFrame(() => {
      const next = tableRegion.current?.querySelector<HTMLButtonElement>('button[data-remove-comparison]')
      if (next) next.focus()
      else heading.current?.focus()
    })
  }
  return <div className="comparison-view">
    <h2 ref={heading} tabIndex={-1}>مقایسهٔ انتخاب‌ها</h2>
    <p><a href="#search">بازگشت به جست‌وجو</a></p>
    {missing > 0 && <p role="status">بعضی انتخاب‌ها در داده‌های فعلی پیدا نشدند؛ اطلاعات قدیمی نمایش داده نمی‌شود. دوباره از نتایج فعلی انتخاب کنید.</p>}
    {!entries.length && <p role="status">{status === 'loading' ? 'جست‌وجوی تازه در حال انجام است؛ انتخاب‌های قبلی نمایش داده نمی‌شوند.'
      : status === 'error' ? 'نتیجهٔ معتبری برای مقایسه در دسترس نیست. به جست‌وجو برگردید و دوباره تلاش کنید.'
        : 'هنوز انتخاب معتبری برای مقایسه ندارید. از نتایج جست‌وجو آفرهای مورد نظر را انتخاب کنید.'}</p>}
    {!entries.length && <p className="muted">با تغییر معیارها یا داده‌ها، انتخاب‌های قبلی پاک می‌شوند.</p>}
    {entries.length === 1 && <p role="status">یک آفر انتخاب شده است؛ برای مقایسه، آفر دیگری از نتایج جست‌وجو اضافه کنید.</p>}
    {entries.length > 0 && <>
      <aside className="comparison-warning" aria-label="محدودیت‌های اطلاعات">
        <p>موجودی و قیمت فعلی تأیید نشده‌اند. نام و هویت فروشگاه‌ها ساختگی یا تأییدنشده است؛ اطلاعات تماس ساختگی است و برای تماس مناسب نیست.</p>
        <p>پوشش داده محدود و ناقص است؛ این مقایسه فقط بر پایهٔ آفرهای بازیابی‌شده است و همهٔ بازار را پوشش نمی‌دهد.</p>
        {dataset?.source_kind === 'sample' && <p>منبع این مقایسه، دادهٔ نمونه و ساختگی است.</p>}
      </aside>
      <p id="comparison-scroll-help" className="muted">برای دیدن همهٔ ستون‌ها، جدول را در همین کادر افقی جابه‌جا کنید. با صفحه‌کلید، کادر جدول را انتخاب و از کلیدهای جهت استفاده کنید.</p>
      <div ref={tableRegion} className="comparison-scroll" role="region" aria-label="جدول مقایسهٔ آفرها" aria-describedby="comparison-scroll-help" tabIndex={0}>
        <table className="comparison-table" style={{ minInlineSize: `calc(var(--comparison-label-width) + ${entries.length} * var(--comparison-offer-width))` }}>
          <caption>اطلاعات ثبت‌شدهٔ آفرهای انتخابی؛ ترتیب انتخاب‌ها حفظ شده است.</caption>
          <thead><tr><th scope="col">ویژگی</th>{entries.map(entry => <th scope="col" key={JSON.stringify(entry.key)}>
            <p>{entry.result.candidate.product.persian_title}</p>
            <p>آفر: <bdi>{entry.key.offer_id}</bdi></p>
            <button data-remove-comparison className="secondary-button" aria-label={`حذف ${entry.result.candidate.product.persian_title}، آفر ${entry.key.offer_id} از مقایسه`}
              onClick={() => remove(entry.key)}>حذف از مقایسه</button>
          </th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{entries.map(entry =>
            <td key={JSON.stringify(entry.key)}>{row.value(entry)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {dataset && <section className="comparison-provenance" aria-labelledby="comparison-source-title">
        <h3 id="comparison-source-title">منبع و پوشش داده</h3>
        <dl>
          <dt>شناسهٔ دیتاست</dt><dd><bdi>{dataset.dataset_id}</bdi></dd>
          <dt>نوع منبع</dt><dd>{dataset.source_kind === 'sample' ? 'نمونه و ساختگی' : 'دادهٔ واردشده؛ هویت فروشگاه‌ها تأیید نشده است'}</dd>
          <dt>زمان ورود داده</dt><dd>{recordedTimestamp(dataset.imported_at)}؛ این زمان، تأیید موجودی یا قیمت نیست.</dd>
          <dt>پوشش جغرافیایی منبع</dt><dd>دادهٔ تهران؛ پوشش ناقص</dd>
          <dt>پوشش بازیابی جست‌وجوی اولیه</dt><dd>{recordedNumber(response?.original.coverage.retrieved_count)} آفر از {recordedNumber(response?.original.coverage.catalog_total)} رکورد همین پرس‌وجو؛ {response?.original.coverage.complete_for_query ? 'بازیابی این پرس‌وجو کامل است؛ پوشش بازار کامل نیست.' : 'بازیابی این پرس‌وجو به سقف مجاز رسیده است.'}</dd>
          <dt>بازیابی‌های شامل جایگزین‌ها</dt><dd>{response?.coverage.map((coverage, index) => <p key={index}>پرس‌وجوی {recordedNumber(index + 1)}: {recordedNumber(coverage.retrieved_count)} از {recordedNumber(coverage.catalog_total)} رکورد؛ {coverage.complete_for_query ? 'بازیابی کامل در همین پرس‌وجو' : 'بازیابی محدود'}</p>)}</dd>
        </dl>
        <details><summary>شناسهٔ محتوای منبع</summary><p><bdi>{dataset.source_sha256}</bdi></p></details>
      </section>}
    </>}
  </div>
}
