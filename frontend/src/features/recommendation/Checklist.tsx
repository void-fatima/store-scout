import { useEffect, useRef } from 'react'
import type { ResponseEntry } from '../../journey/operations'
import { Icon } from '../../shell/Icon'
import { OfferCard } from './OfferCard'
import { offerHash } from './presentation'
import { useOwningVerification } from './useOwningVerification'
import { RecordedVisitConditions, VerificationQuestions } from './VerificationContent'

export function Checklist({ entry, selected, onToggle, selectionDisabled }: {
  entry: ResponseEntry; selected: boolean; selectionDisabled: boolean
  onToggle: NonNullable<Parameters<typeof OfferCard>[0]['onToggle']>
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const plan = useOwningVerification(entry)
  useEffect(() => {
    // Preserve an owning action restored by parent navigation, including effect
    // replay; resolving a plan must not steal that keyboard return focus.
    const active = document.activeElement
    const restoredAction = active instanceof HTMLElement && active.matches('[data-offer-action]') && active.closest('.checklist-grid')
    if (plan && !restoredAction) heading.current?.focus()
  }, [plan])
  const back = entry.source === 'alternative' ? offerHash('alternative', entry.key) : '#results'
  if (!entry.plan) return <div className="recommendation-state"><h2 id="recommendation-title" tabIndex={-1}>برنامهٔ بررسی برای این آفر در دسترس نیست</h2><a className="outline-action" href="#results">بازگشت به پیشنهادها</a></div>
  if (!plan) return <div><h2 id="recommendation-title" tabIndex={-1}>آماده‌سازی برنامهٔ بررسی</h2><p role="status">برنامه باید با انتخاب فعلی هماهنگ شود.</p><a className="outline-action" href={back}>بازگشت به پیشنهادها</a></div>
  return <>
    <a className="detail-back" href={back}><Icon name="arrow" />{entry.source === 'alternative' ? 'بازگشت به جایگزین' : 'بازگشت به پیشنهادها'}</a>
    <div className="detail-heading"><h2 ref={heading} id="recommendation-title" tabIndex={-1}>چک‌لیست پیش از مراجعه</h2><p>این موارد هنوز نیازمند بررسی تو هستند؛ اطلاعات ثبت‌شده، تأیید موجودی یا قیمت فعلی نیست.</p></div>
    <div className="detail-grid checklist-grid"><div className="checklist-offer">
      {entry.source === 'alternative' && <p className="alternative-badge">جایگزین با معیارهای اولیه تأیید نشده؛ باز کردن این برنامه، پذیرش تغییرها نیست.</p>}
      <OfferCard result={entry.result} entry={entry} detail hideChecklist selected={selected} selectionDisabled={selectionDisabled} onToggle={onToggle} />
      <RecordedVisitConditions entry={entry} plan={plan} />
    </div><section className="detail-surface">
      <VerificationQuestions entry={entry} plan={plan} />
      <a className="outline-action" href="#results">بازگشت به پیشنهادها</a>
    </section></div>
  </>
}
