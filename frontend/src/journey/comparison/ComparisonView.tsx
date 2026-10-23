import { useRef } from 'react'
import type { ReactNode } from 'react'
import type { AlternativesResponse, ComparisonKey, RecommendationPanelProps } from '../../contracts'
import { responseEntries, sameValue } from '../operations'
import type { ResponseEntry } from '../operations'
import { recordedHours, recordedNumber, recordedPayments, recordedText, recordedTimestamp, unknown } from './recordedValues'
import { ProductVisual } from '../../features/recommendation/ProductVisual'
import { exactMoney, offerHash } from '../../features/recommendation/presentation'
import { Icon } from '../../shell/Icon'
import hero from '../../assets/search-hero.jpg'
import './comparison.css'

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
  { label: 'قیمت ثبت‌شده', value: ({ result }) => result.candidate.price_toman == null
    ? `${unknown}؛ واحد قیمت‌های ثبت‌شده: تومان` : `${exactMoney(String(result.candidate.price_toman))} تومان` },
  { label: 'فاصلهٔ مستقیم', value: ({ result }) => result.candidate.distance_km == null ? unknown : `${recordedNumber(result.candidate.distance_km)} کیلومتر (مستقیم)` },
  { label: 'موجودی', value: () => 'تأییدنشده؛ پیش از مراجعه بررسی کنید.' },
  { label: 'شناسهٔ کالا', value: ({ result }) => <bdi>{result.product_id}</bdi> },
  { label: 'برند و مدل', value: ({ result }) => <>{recordedText(result.candidate.product.brand_name)} / {recordedText(result.candidate.product.model)}</> },
  { label: 'دستهٔ کالا', value: ({ result }) => recordedText(result.candidate.product.category_name) },
  { label: 'فروشگاه', value: ({ result }) => <>{result.candidate.shop.name}<br />شناسه: <bdi>{result.shop_id}</bdi><br />هویت ساختگی یا تأییدنشده</> },
  { label: 'عنوان و توضیح ثبت‌شدهٔ فروشنده', value: ({ result }) => <>{recordedText(result.candidate.seller_title)}<br />{recordedText(result.candidate.description)}</> },
  { label: 'نشانی ثبت‌شده', value: ({ result }) => <>{recordedText(result.candidate.shop.address)}<br />محدوده: {recordedText(result.candidate.shop.location_label)}</> },
  { label: 'مختصات فروشگاه', value: ({ result }) => <>عرض: <bdi>{recordedNumber(result.candidate.shop.lat)}</bdi><br />طول: <bdi>{recordedNumber(result.candidate.shop.lon)}</bdi></> },
  { label: 'ساعات کاری ثبت‌شده', value: entry => <RecordedHours entry={entry} /> },
  { label: 'روش‌های پرداخت ثبت‌شده', value: ({ result }) => recordedPayments(result.candidate.shop.payment_options) },
  { label: 'گارانتی ثبت‌شده', value: ({ result }) => result.candidate.warranty?.trim() ? `${result.candidate.warranty} (تأییدنشده)` : unknown },
  // The schema contains requested return preferences, not a seller return policy.
  { label: 'شرایط بازگشت کالا', value: () => unknown },
  { label: 'آخرین تغییر قیمت', value: ({ result }) => <>{recordedTimestamp(result.candidate.last_price_changed_at)}<br />زمان تغییر، زمان تأیید قیمت یا موجودی نیست.</> },
  { label: 'نوع نتیجه', value: ({ source }) => source === 'original' ? 'از نتایج جست‌وجوی فعلی؛ موجودی تأیید نشده است.' : 'از جایگزین‌ها؛ با معیارهای اولیه تأیید نشده و نیازمند پذیرش تغییرهاست.' },
  { label: 'ابهام‌ها و محدودیت‌ها', value: ({ result }) => <ul className="comparison-limitations">{result.data_limitations.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul> },
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
  const warnings = response ? [...new Set([...response.warnings, ...(response.original.notices ?? []), ...(response.original.context.notices ?? [])])] : []

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
    <div className="comparison-hero"><div><span className="comparison-selection-count">{recordedNumber(entries.length)} انتخاب از حداکثر ۱۰ آفر</span>
      <h2 ref={heading} tabIndex={-1}>مقایسهٔ انتخاب‌ها</h2><p className="comparison-lead">جزئیات را کنار هم ببین</p><p>با آگاهی از تفاوت‌ها و اطلاعات نامشخص، انتخاب کن.</p>
      <div className="comparison-return-links"><a href="#results" className="outline-action"><Icon name="arrow" />بازگشت به پیشنهادها</a><a href="#search">بازگشت به جست‌وجو</a>
        {entries.some(entry => entry.source === 'alternative') && <a href="#alternatives">بازگشت به جایگزین‌ها</a>}
      </div></div><img src={hero} width="887" height="290" alt="" /></div>
    {missing > 0 && <p role="status">بعضی انتخاب‌ها در داده‌های فعلی پیدا نشدند؛ اطلاعات قدیمی نمایش داده نمی‌شود. دوباره از نتایج فعلی انتخاب کنید.</p>}
    {!entries.length && <div className="comparison-empty"><Icon name="compare" /><p role="status">{status === 'loading' ? 'جست‌وجوی تازه در حال انجام است؛ انتخاب‌های قبلی نمایش داده نمی‌شوند.'
      : status === 'error' ? 'نتیجهٔ معتبری برای مقایسه در دسترس نیست. به جست‌وجو برگردید و دوباره تلاش کنید.'
        : 'هنوز انتخاب معتبری برای مقایسه ندارید. از نتایج جست‌وجو آفرهای مورد نظر را انتخاب کنید.'}</p></div>}
    {!entries.length && <p className="muted">با تغییر معیارها یا داده‌ها، انتخاب‌های قبلی پاک می‌شوند.</p>}
    {entries.length === 1 && <p role="status" className="comparison-guidance">یک آفر انتخاب شده است؛ برای مقایسه، آفر دیگری از نتایج جست‌وجو اضافه کنید.</p>}
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
          <thead><tr><th scope="col"><Icon name="compare" /><p>کالا و فروشگاه</p><span className="muted">اطلاعات ثبت‌شده</span></th>{entries.map(entry => <th scope="col" key={JSON.stringify(entry.key)}>
            <div className="comparison-product-header"><button data-remove-comparison className="comparison-remove" aria-label={`حذف ${entry.result.candidate.product.persian_title}، آفر ${entry.key.offer_id} از مقایسه`}
              onClick={() => remove(entry.key)}>حذف از مقایسه <span aria-hidden="true">×</span></button>
              <ProductVisual product={entry.result.candidate.product} />
              <h3>{entry.result.candidate.product.persian_title}</h3><p className="comparison-shop"><Icon name="store" />{entry.result.candidate.shop.name}</p>
              <p className="comparison-offer-id">آفر: <bdi>{entry.key.offer_id}</bdi></p>
              {entry.source === 'alternative' && <span className="comparison-alternative-badge">جایگزین؛ تغییرها پذیرفته نشده‌اند</span>}
            </div>
          </th>)}</tr></thead>
          <tbody>{rows.map(row => <tr key={row.label} className={row.label === 'قیمت ثبت‌شده' ? 'comparison-price-row' : row.label === 'فاصلهٔ مستقیم' ? 'comparison-distance-row' : ''}><th scope="row">{row.label}</th>{entries.map(entry =>
            <td key={JSON.stringify(entry.key)}>{row.value(entry)}</td>)}</tr>)}</tbody>
          <tfoot><tr><th scope="row">پیش از مراجعه</th>{entries.map(entry => <td key={JSON.stringify(entry.key)}>
            {entry.plan ? <a className="outline-action" href={offerHash('checklist', entry.key)}>چک‌لیست پیش از مراجعه</a> : <p>برنامهٔ بررسی نامشخص است.</p>}
            <a className="comparison-detail-link" href={offerHash(entry.source === 'alternative' ? 'alternative' : 'explanation', entry.key)}>{entry.source === 'alternative' ? 'دیدن تغییرهای پیشنهادی' : 'دیدن دلیل پیشنهاد'}</a>
          </td>)}</tr></tfoot>
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
        {!!warnings.length && <details><summary>هشدارها و محدودیت‌های منبع</summary><ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
      </section>}
    </>}
  </div>
}
