import { useEffect, useId, useState } from 'react'
import type { AlternativesResponse, ComparisonKey, ProductDetail } from '../../contracts'
import { compatibleProduct, createProductDetailClient } from '../../api/productDetail'
import type { ProductDetailClient, ProductDetailResult } from '../../api/productDetail'
import { userError } from '../../api/journey'
import type { ResponseEntry } from '../../journey/operations'
import { recordedHours, recordedPayments, recordedText } from '../../journey/comparison/recordedValues'
import { Icon } from '../../shell/Icon'
import { OfferFacts } from './OfferCard'
import { ProductVisual } from './ProductVisual'
import { SourceBadge } from './Provenance'
import { offerHash, productHash } from './presentation'
import type { ProductTab } from './presentation'
import { Specifications } from './Specifications'
import { ProductFit } from './ProductFit'
import { ProductTabs } from './ProductTabs'

const client = createProductDetailClient()
type Load = { owner: AlternativesResponse; identity: string; result: ProductDetailResult }

function errorText(result: Extract<ProductDetailResult, { ok: false }>) {
  const code = result.failure.error.error.code
  if (code === 'product_not_found') return 'رکورد کالا در منبع فعلی پیدا نشد.'
  if (code === 'product_snapshot_changed' || code === 'product_context_unavailable') return 'مشخصات با کالا یا منبع این جست‌وجو سازگار نیست. جست‌وجو را تازه کن.'
  if (result.failure.status === 503) return 'مشخصات کالا موقتاً در دسترس نیست. دوباره تلاش کن.'
  if (result.failure.kind === 'invalid_response') return 'پاسخ معتبر برای مشخصات کالا دریافت نشد.'
  return userError(result.failure.error).error.message
}

export function ProductDetails({ entry, response, requestId, revision, previousHash, selected, selectionDisabled, onToggle, detailClient = client, tab = 'specs' }: {
  entry: ResponseEntry; response: AlternativesResponse; requestId: string; revision: number
  previousHash: string | null; selected: boolean; selectionDisabled: boolean; onToggle: (key: ComparisonKey) => void
  detailClient?: ProductDetailClient
  tab?: ProductTab
}) {
  const tabPrefix = useId()
  const context = response.original.context
  const identity = JSON.stringify([requestId, revision, entry.key, context])
  const [returnHash] = useState(() => previousHash && !previousHash.startsWith('#product/') && !['#edit-search', '#comparison'].includes(previousHash)
    ? previousHash : entry.source === 'alternative' ? '#alternatives' : '#results')
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<Load | null>(null)
  const productId = entry.key.product_id
  const validContext = !!context.dataset && context.dataset.dataset_id === entry.key.dataset_id
    && entry.result.product_id === productId && entry.result.candidate.product.product_id === productId
    && entry.result.offer_id === entry.key.offer_id && entry.result.candidate.offer_id === entry.key.offer_id
  useEffect(() => {
    if (!validContext) return
    const abort = new AbortController()
    let current = true
    // Start only after the effect is committed: StrictMode replay or an immediate
    // navigation can cancel before any HTTP request is sent.
    void Promise.resolve().then(async () => {
      if (!current || abort.signal.aborted) return
      const result = await detailClient(productId, context, abort.signal)
      if (current && !abort.signal.aborted) setLoad({ owner: response, identity, result })
    })
    return () => { current = false; abort.abort() }
  }, [attempt, context, detailClient, identity, productId, response, validContext])
  const result = load?.owner === response && load.identity === identity ? load.result : null
  const detail: ProductDetail | null = result?.ok && compatibleProduct(result.value, productId, context) ? result.value : null
  const product = detail?.item ?? entry.result.candidate.product
  const candidate = entry.result.candidate
  return <>
    <a className="detail-back" href={returnHash}><Icon name="arrow" />بازگشت به {returnHash === '#alternatives' ? 'جایگزین‌ها' : returnHash.startsWith('#explanation/') ? 'دلیل پیشنهاد' : returnHash.startsWith('#alternative/') ? 'بررسی جایگزین' : 'پیشنهادها'}</a>
    <div className="detail-heading"><h2 id="recommendation-title" tabIndex={-1}>جزئیات کالای ثبت‌شده</h2>
      <p>مشخصات کالا از همان منبع جست‌وجو دریافت می‌شود؛ شرایط فروش به آفر انتخاب‌شده مربوط است.</p><SourceBadge response={response} /></div>
    {entry.source === 'alternative' && <p className="uncertainty-note">این کالا یک پیشنهاد جایگزین است؛ دیدن مشخصات، پذیرش تغییر معیارها نیست.</p>}
    <div className="product-detail-grid">
      <section className="detail-surface product-specification" aria-labelledby="product-record-title">
        <div className="product-record-heading"><div><h3 id="product-record-title">{product.persian_title}</h3>
          <dl className="product-identity"><dt>برند ثبت‌شده</dt><dd>{recordedText(product.brand_name)}</dd>
            <dt>مدل ثبت‌شده</dt><dd><bdi>{recordedText(product.model)}</bdi></dd>
            <dt>دسته‌بندی</dt><dd>{recordedText(product.category_name)}</dd></dl></div>
          <ProductVisual key={JSON.stringify([productId, product.image_urls])} product={product} /></div>
        <ProductTabs selected={tab} prefix={tabPrefix} onSelect={next => { window.location.hash = productHash(entry.key, next) }} />
        <div role="tabpanel" id={`${tabPrefix}-specs-panel`} aria-labelledby={`${tabPrefix}-specs-tab`} tabIndex={0} hidden={tab !== 'specs'} aria-busy={validContext && !result}>
          <h3>مشخصات کالا</h3>
          {!validContext ? <p role="alert">منبع یا شناسهٔ فعلی کالا سازگار نیست؛ مشخصات در دسترس نیست.</p>
            : !result ? <p role="status">در حال دریافت مشخصات ثبت‌شده…</p>
              : detail ? <><p className="muted">مقادیر زیر عیناً از رکورد کالا هستند؛ مقدار تهی یا خالی به معنی ویژگی تأییدشده نیست.</p><Specifications specs={detail.item.specs} /></>
                : <div className="product-detail-error"><p role="alert">{result.ok ? 'مشخصات با منبع فعلی سازگار نیست.' : errorText(result)}</p>
                  <button className="secondary-button" onClick={() => { setLoad(null); setAttempt(value => value + 1) }}>تلاش دوباره برای مشخصات</button></div>}
        </div>
        <div role="tabpanel" id={`${tabPrefix}-fit-panel`} aria-labelledby={`${tabPrefix}-fit-tab`} tabIndex={0} hidden={tab !== 'fit'}>
          {validContext ? <ProductFit entry={entry} response={response} /> : <p role="alert">منبع یا شناسهٔ فعلی کالا سازگار نیست؛ دلیل‌های قبلی نمایش داده نمی‌شوند.</p>}
        </div>
      </section>
      <section className="detail-surface product-selected-offer" aria-labelledby="selected-offer-title">
        <h3 id="selected-offer-title">آفر انتخاب‌شده و شرایط فروش</h3><OfferFacts result={entry.result} />
        <label className="compare-choice"><input type="checkbox" checked={selected} disabled={!selected && selectionDisabled}
          aria-label={`مقایسهٔ ${candidate.product.persian_title}، آفر ${entry.key.offer_id}`} onChange={() => onToggle(entry.key)} />{selected ? 'حذف از مقایسه' : 'انتخاب برای مقایسه'}</label>
        <dl className="product-identity"><dt>گارانتی ثبت‌شده</dt><dd>{recordedText(candidate.warranty)}؛ تأیید نشده</dd>
          <dt>پرداخت اعلام‌شدهٔ فروشگاه</dt><dd>{recordedPayments(candidate.shop.payment_options)}</dd>
          <dt>عنوان فروشنده</dt><dd>{recordedText(candidate.seller_title)}</dd>
          <dt>توضیح آفر</dt><dd>{recordedText(candidate.description)}</dd>
          <dt>سیاست بازگشت</dt><dd>نامشخص</dd>
          <dt>شناسهٔ آفر</dt><dd><bdi>{entry.key.offer_id}</bdi></dd></dl>
        <details className="offer-record-details"><summary>ساعت کاری اعلام‌شده</summary><ul>{recordedHours(candidate.shop.weekly_hours).map(day => <li key={day.day}>{day.label}: {day.hours}</li>)}</ul>
          <p>ساعت‌ها تأیید نشده‌اند؛ باز بودن فعلی فروشگاه مشخص نیست.</p></details>
        <p className="uncertainty-note">قیمت ثبت‌شده و موجودی فعلی تأیید نشده‌اند. اطلاعات تماس ساختگی برای تماس مناسب نیست.</p>
        <div className="offer-card-actions">{entry.plan && <a className="outline-action" href={offerHash('checklist', entry.key)} data-offer-action={offerHash('checklist', entry.key)}>چک‌لیست پیش از مراجعه</a>}
          <a className="outline-action" href={returnHash}>بازگشت و حفظ انتخاب‌ها</a></div>
      </section>
    </div>
  </>
}
