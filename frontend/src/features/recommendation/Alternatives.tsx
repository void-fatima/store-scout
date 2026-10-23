import { useEffect, useRef, useState } from 'react'
import type { AlternativeSuggestion, RecommendationPanelProps, ShoppingCriteria } from '../../contracts'
import type { ResponseEntry } from '../../journey/operations'
import { sameValue } from '../../journey/operations'
import { recordedNumber } from '../../journey/comparison/recordedValues'
import { Icon } from '../../shell/Icon'
import { OfferCard } from './OfferCard'
import { currencyLabel, exactMoney } from './presentation'

type Toggle = NonNullable<Parameters<typeof OfferCard>[0]['onToggle']>
function criteriaValue(criteria: ShoppingCriteria, field: 'query' | 'max_budget' | 'max_distance_km') {
  if (field === 'query') return criteria.query
  if (field === 'max_budget') return `${exactMoney(criteria.max_budget)} ${currencyLabel(criteria.price_unit)}`
  return criteria.max_distance_km == null ? 'بدون شعاع مشخص' : `${recordedNumber(criteria.max_distance_km)} کیلومتر`
}
export function ProposedChanges({ suggestion }: { suggestion: AlternativeSuggestion }) {
  return <div className="proposed-changes">
    <p className="muted">معیار فعلی و معیار پیشنهادی را پیش از پذیرش مقایسه کن.</p>
    <dl>{([['query', 'نام کالا'], ['max_budget', 'سقف بودجه'], ['max_distance_km', 'شعاع جست‌وجو']] as const).map(([field, label]) => {
      const changed = !sameValue(suggestion.original_constraints[field], suggestion.relaxed_constraints[field])
        || (field === 'max_budget' && suggestion.original_constraints.price_unit !== suggestion.relaxed_constraints.price_unit)
      return <div className={changed ? 'constraint-change is-changed' : 'constraint-change'} key={field}>
        <dt>{label}<span>{changed ? 'پیشنهاد تغییر' : 'بدون تغییر'}</span></dt>
        <dd><span>فعلی</span><strong>{criteriaValue(suggestion.original_constraints, field)}</strong></dd>
        <dd><span>پیشنهادی</span><strong>{criteriaValue(suggestion.relaxed_constraints, field)}</strong></dd>
      </div>
    })}</dl>
  </div>
}

export function AlternativesList({ response, entries, comparison, onToggle }: {
  response: NonNullable<RecommendationPanelProps['response']>; entries: ResponseEntry[]
  comparison: RecommendationPanelProps['comparison']; onToggle: Toggle
}) {
  return <>
    <a className="detail-back" href="#results"><Icon name="arrow" />بازگشت به پیشنهادها</a>
    <div className="detail-heading"><h2 id="recommendation-title" tabIndex={-1}>با یک تغییر، گزینه‌های بیشتری ببین</h2>
      <p>این جایگزین‌ها با معیارهای اولیه تأیید نشده‌اند. دیدن یا مقایسهٔ آن‌ها تغییری در جست‌وجو ایجاد نمی‌کند.</p></div>
    {!response.suggestions.length && <p>در پاسخ فعلی، پیشنهاد جایگزینی ثبت نشده است.</p>}
    <div className="alternatives-list">{response.suggestions.map((suggestion, index) => {
      const entry = entries.find(item => item.source === 'alternative' && item.result === suggestion.result)
      return <section className="alternative-section" key={JSON.stringify([suggestion.result.product_id, suggestion.result.offer_id])} aria-label={`جایگزین ${recordedNumber(index + 1)}`}>
        <div className="alternative-section-heading"><span className="alternative-badge">پیشنهاد جایگزین {recordedNumber(index + 1)}</span><p>{suggestion.explanation}</p></div>
        <div className="detail-grid"><OfferCard result={suggestion.result} entry={entry}
          selected={!!entry && comparison.some(key => sameValue(key, entry.key))} selectionDisabled={comparison.length >= 10} onToggle={onToggle} />
          <div className="detail-surface"><h3>این پیشنهاد چه تغییری می‌خواهد؟</h3><ProposedChanges suggestion={suggestion} />
            <ul className="limitations-list">{suggestion.result.data_limitations.map((item, i) => <li key={`${item.code}-${i}`}>{item.message}</li>)}</ul>
            <p className="uncertainty-note">تا پذیرش صریح تو، معیارها تغییر نمی‌کنند؛ موجودی و قیمت فعلی تأیید نشده‌اند.</p>
          </div></div>
      </section>
    })}</div>
  </>
}

function Confirmation({ suggestion, onConfirm, onClose }: {
  suggestion: AlternativeSuggestion; onConfirm: () => void; onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const submitted = useRef(false)
  const [accepted, setAccepted] = useState(false)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className="acceptance-dialog" aria-labelledby="acceptance-title" aria-describedby="acceptance-effect" onCancel={event => { event.preventDefault(); onClose() }}>
    <h2 id="acceptance-title">مرور و تأیید تغییرهای جست‌وجو</h2>
    <p>{suggestion.explanation}</p>
    <ProposedChanges suggestion={suggestion} />
    <p id="acceptance-effect">با تأیید، جست‌وجوی تازه‌ای با معیارهای پیشنهادی انجام می‌شود. نتیجه‌ها، مقایسه و برنامهٔ قبلی پاک می‌شوند؛ موجودی تأیید نمی‌شود.</p>
    <label className="acceptance-consent"><input type="checkbox" checked={accepted} disabled={confirming} onChange={event => setAccepted(event.target.checked)} />همهٔ تغییرهای بالا را بررسی کردم و می‌پذیرم</label>
    <div className="state-actions"><button className="primary-button" disabled={!accepted || confirming} onClick={() => {
      if (!accepted || submitted.current) return
      submitted.current = true
      setConfirming(true)
      onConfirm()
    }}>پذیرش و جست‌وجوی تازه</button><button className="secondary-button" disabled={confirming} onClick={onClose} autoFocus>انصراف</button></div>
  </dialog>
}

export function AlternativeReview({ suggestion, entry, props, onToggle }: {
  suggestion: AlternativeSuggestion; entry: ResponseEntry; props: RecommendationPanelProps; onToggle: Toggle
}) {
  const [reviewing, setReviewing] = useState<{ response: RecommendationPanelProps['response']; suggestion: AlternativeSuggestion } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  function close() { setReviewing(null); requestAnimationFrame(() => trigger.current?.focus()) }
  return <>
    <a className="detail-back" href="#alternatives"><Icon name="arrow" />بازگشت به جایگزین‌ها</a>
    <div className="detail-heading"><h2 id="recommendation-title" tabIndex={-1}>این جایگزین چه تغییری می‌خواهد؟</h2><p>{suggestion.explanation}</p></div>
    <div className="detail-grid"><OfferCard result={entry.result} entry={entry} detail
      selected={props.comparison.some(key => sameValue(key, entry.key))} selectionDisabled={props.comparison.length >= 10} onToggle={onToggle} />
      <section className="detail-surface" aria-labelledby="proposal-title"><h3 id="proposal-title">معیارهای فعلی و پیشنهادی</h3>
        <ProposedChanges suggestion={suggestion} />
        <ul className="limitations-list">{entry.result.data_limitations.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul>
        <p className="uncertainty-note">این آفر با معیارهای اولیه تأیید نشده است. مقایسه و باز کردن چک‌لیست به معنی پذیرش تغییرها نیست.</p>
        <button ref={trigger} className="primary-button review-trigger" onClick={() => setReviewing({ response: props.response, suggestion })}>مرور و تأیید تغییرها</button>
      </section></div>
    {reviewing?.response === props.response && reviewing?.suggestion === suggestion && <Confirmation suggestion={suggestion} onClose={close} onConfirm={() => {
      // The controller validates the canonical consent payload and sends a fresh POST.
      window.location.hash = 'results'
      props.onAcceptAlternative({ request_id: props.requestId, expected_revision: props.revision,
        dataset_id: entry.key.dataset_id, offer_id: entry.key.offer_id, accepted_changes: suggestion.changes })
    }} />}
  </>
}
