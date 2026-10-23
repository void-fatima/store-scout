import { useEffect, useRef } from 'react'
import type { ComparisonKey, RecommendationPanelProps } from '../../contracts'
import { responseEntries, sameValue } from '../../journey/operations'
import { recordedNumber } from '../../journey/comparison/recordedValues'
import { Icon } from '../../shell/Icon'
import { Explanation } from './Explanation'
import { OfferCard } from './OfferCard'
import { Provenance, SourceBadge } from './Provenance'
import { currencyLabel, editCriteria, exactMoney, offerHash, parsePanelRoute } from './presentation'
import { usePanelHash } from './usePanelHash'
import './recommendation.css'

export function RecommendationPanel(props: RecommendationPanelProps) {
  const { status, response, comparison, requestId, revision } = props
  const hash = usePanelHash()
  const route = parsePanelRoute(hash)
  const previousRoute = useRef<string | null>(null)
  const previousStatus = useRef(status)
  const entries = response ? responseEntries(response).filter(entry => entry.source === 'original') : []
  const active = route && entries.find(entry => sameValue(entry.key, route.key))
  useEffect(() => {
    // Do not steal focus from actionable backend field errors.
    const shouldFocus = (status === 'ready' && previousStatus.current !== 'ready') || previousRoute.current !== hash
    if (shouldFocus && status === 'ready' && !['#comparison', '#guide', '#edit-search'].includes(hash)) {
      const previous = previousRoute.current && parsePanelRoute(previousRoute.current)
      const target = !parsePanelRoute(hash) && previous
        ? [...document.querySelectorAll<HTMLElement>('[data-offer-action]')].find(node => node.dataset.offerAction === offerHash('explanation', previous.key))
        : null
      const focusTarget = target ?? document.getElementById('recommendation-title')
      focusTarget?.focus()
    }
    previousRoute.current = hash
    previousStatus.current = status
  }, [hash, status, requestId, revision])

  function toggle(key: ComparisonKey) {
    if (status !== 'ready') return
    const selected = comparison.some(item => sameValue(item, key))
    if (!selected && comparison.length >= 10) return
    props.onComparisonChange(selected ? comparison.filter(item => !sameValue(item, key)) : [...comparison, key])
  }
  if (status === 'idle') return null
  return <section className="recommendation-panel" aria-labelledby="recommendation-title">
    {status === 'loading' ? <>
      <h2 id="recommendation-title" role="status">در حال بررسی رکوردهای ثبت‌شده…</h2>
      <p className="muted">پیشنهادها بر اساس معیارهای تو از سرویس دریافت می‌شوند.</p>
      <div className="offer-grid" aria-hidden="true">{[1, 2, 3].map(key => <div key={key} className="offer-card skeleton-card"><div /><span /><span /><span /></div>)}</div>
      <button className="secondary-button" onClick={editCriteria}>ویرایش معیارها</button>
    </> : status === 'error' ? <div className="recommendation-state">
      <div className="state-symbol"><Icon name="retry" /></div>
      <h2 id="recommendation-title">جست‌وجو انجام نشد</h2>
      <p role="alert">{props.error?.error.message ?? 'پاسخ معتبر دریافت نشد. دوباره تلاش کن.'}</p>
      <p className="retained-criteria">اطلاعات جست‌وجوی تو حفظ شده است.</p>
      <div className="state-actions"><button className="primary-button" onClick={() => props.onRetry(requestId, revision)}><Icon name="retry" /> تلاش دوباره</button><button className="secondary-button" onClick={editCriteria}>ویرایش معیارها</button></div>
    </div> : response ? <>
      {route ? active ? <Explanation entry={active} rank={entries.indexOf(active) + 1} response={response}
        selected={comparison.some(key => sameValue(key, active.key))} selectionDisabled={comparison.length >= 10} onToggle={toggle} />
        : <div className="recommendation-state"><h2 id="recommendation-title" tabIndex={-1}>این پیشنهاد در نتیجهٔ فعلی در دسترس نیست</h2><p>ممکن است معیارها یا منبع داده تغییر کرده باشد.</p><a className="outline-action" href="#results">بازگشت به پیشنهادها</a></div>
      : <>
        <div className="result-toolbar"><h2 id="recommendation-title" tabIndex={-1}>پیشنهادهای مناسب تو</h2><span className="result-count">{recordedNumber(response.original.recommendations.length)} پیشنهاد</span><p className="muted">به ترتیب رتبه‌بندی سرویس</p></div>
        <div className="result-context"><span className="criteria-chip">{response.original_constraints.query}</span><span className="criteria-chip">تا {exactMoney(response.original_constraints.max_budget)} {currencyLabel(response.original_constraints.price_unit)}</span>
          {response.original_constraints.max_distance_km != null && <span className="criteria-chip">شعاع {recordedNumber(response.original_constraints.max_distance_km)} کیلومتر</span>}
          <button className="text-action" onClick={editCriteria}>ویرایش معیارها</button>
        </div>
        <SourceBadge response={response} />
        <p className="uncertainty-note">قیمت‌ها ثبت‌شده‌اند؛ موجودی تأیید نشده است. هویت فروشگاه‌ها ساختگی یا تأییدنشده و پوشش بازار محدود است.</p>
        {response.original.recommendations.length ? <div className="offer-grid">{response.original.recommendations.map((result, index) => {
          const entry = entries.find(item => item.result === result)
          return <OfferCard key={JSON.stringify([response.original.context.dataset?.dataset_id, result.product_id, result.offer_id])} result={result} entry={entry} rank={index + 1}
            selected={!!entry && comparison.some(key => sameValue(key, entry.key))} selectionDisabled={comparison.length >= 10} onToggle={toggle} />
        })}</div> : <div className="recommendation-state">
          <div className="state-symbol"><Icon name="search" /></div>
          <h3>در این جست‌وجو، گزینهٔ مناسبی پیدا نشد</h3>
          <p>این نتیجه فقط مربوط به رکوردهای بررسی‌شده است؛ پوشش بازار کامل نیست.</p>
          <ul className="diagnoses">{response.diagnoses.map((diagnosis, index) => <li key={`${diagnosis.code}-${index}`}>{diagnosis.message}</li>)}</ul>
          <p>از نام دقیق مدل استفاده کن و بودجه و شعاع را بازبینی کن.</p>
          <button className="secondary-button" onClick={editCriteria}>ویرایش معیارها</button>
        </div>}
      </>}
      {!!comparison.length && <aside className="comparison-tray" aria-label="انتخاب‌های مقایسه"><p role="status">{recordedNumber(comparison.length)} گزینه برای مقایسه انتخاب شده است</p><a href="#comparison"><Icon name="compare" />مقایسهٔ گزینه‌ها <Icon name="arrow" /></a></aside>}
      {comparison.length >= 10 && <p role="status">حداکثر ۱۰ آفر قابل انتخاب است؛ برای انتخاب تازه یکی را بردار.</p>}
      <Provenance response={response} />
    </> : <div className="recommendation-state"><h2 id="recommendation-title">نتیجه‌ای در دسترس نیست</h2><button className="secondary-button" onClick={editCriteria}>ویرایش معیارها</button></div>}
  </section>
}
