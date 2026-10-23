import { useContext, useEffect, useRef, useState } from 'react'
import type { FollowupPlan } from '../../contracts'
import type { ResponseEntry } from '../../journey/operations'
import { sameValue } from '../../journey/operations'
import { recordedHours, recordedNumber, recordedPayments, recordedText, recordedTimestamp } from '../../journey/comparison/recordedValues'
import { Icon } from '../../shell/Icon'
import { OfferCard } from './OfferCard'
import { offerHash } from './presentation'
import { VerificationContext } from './VerificationContext'

function PersonalReminders({ plan }: { plan: FollowupPlan }) {
  const [reminders, setReminders] = useState<{ plan: FollowupPlan; checked: number[] }>({ plan, checked: [] })
  const checked = reminders.plan === plan ? reminders.checked : []
  return <>
    <p className="reminder-help">علامت‌ها فقط یادآوری شخصی در همین صفحه‌اند؛ وضعیت همهٔ سؤال‌ها همچنان «در انتظار بررسی» است.</p>
    <ol className="verification-questions">{plan.checklist.map((item, index) => <li key={`${item.topic}-${index}`}>
      <span className="question-number" aria-hidden="true">{recordedNumber(index + 1)}</span>
      <div><p>{item.question}</p><span className="pending-badge">در انتظار بررسی</span>
        <label className="personal-reminder"><input type="checkbox" checked={checked.includes(index)} aria-label={`یادآوری شخصی: ${item.question}`} onChange={event => setReminders({ plan,
          checked: event.target.checked ? [...checked, index] : checked.filter(value => value !== index) })} />یادآوری شخصی برای پیگیری</label>
        <details className="question-evidence"><summary>منبع این سؤال</summary><ul>{item.evidence_paths.map(path => <li key={path}><bdi>{path}</bdi></li>)}</ul></details>
      </div>
    </li>)}</ol>
  </>
}

export function Checklist({ entry, selected, onToggle, selectionDisabled }: {
  entry: ResponseEntry; selected: boolean; selectionDisabled: boolean
  onToggle: NonNullable<Parameters<typeof OfferCard>[0]['onToggle']>
}) {
  const canonicalSelection = useContext(VerificationContext)
  const heading = useRef<HTMLHeadingElement>(null)
  // Standalone Panel consumers can render the owning response plan. In JourneyFlow,
  // use only the plan actually selected and re-resolved by the existing controller.
  const plan = canonicalSelection === undefined ? entry.plan
    : canonicalSelection && sameValue(canonicalSelection.key, entry.key) && canonicalSelection.plan === entry.plan ? canonicalSelection.plan : null
  useEffect(() => { if (plan) heading.current?.focus() }, [plan])
  const back = entry.source === 'alternative' ? offerHash('alternative', entry.key) : '#results'
  if (!entry.plan) return <div className="recommendation-state"><h2 id="recommendation-title" tabIndex={-1}>برنامهٔ بررسی برای این آفر در دسترس نیست</h2><a className="outline-action" href="#results">بازگشت به پیشنهادها</a></div>
  if (!plan) return <div><h2 id="recommendation-title" tabIndex={-1}>آماده‌سازی برنامهٔ بررسی</h2><p role="status">برنامه باید با انتخاب فعلی هماهنگ شود.</p><a className="outline-action" href={back}>بازگشت به پیشنهادها</a></div>
  const { shop } = entry.result.candidate
  return <>
    <a className="detail-back" href={back}><Icon name="arrow" />{entry.source === 'alternative' ? 'بازگشت به جایگزین' : 'بازگشت به پیشنهادها'}</a>
    <div className="detail-heading"><h2 ref={heading} id="recommendation-title" tabIndex={-1}>چک‌لیست پیش از مراجعه</h2><p>این موارد هنوز نیازمند بررسی تو هستند؛ اطلاعات ثبت‌شده، تأیید موجودی یا قیمت فعلی نیست.</p></div>
    <div className="detail-grid checklist-grid"><div className="checklist-offer">
      {entry.source === 'alternative' && <p className="alternative-badge">جایگزین با معیارهای اولیه تأیید نشده؛ باز کردن این برنامه، پذیرش تغییرها نیست.</p>}
      <OfferCard result={entry.result} entry={entry} detail hideChecklist selected={selected} selectionDisabled={selectionDisabled} onToggle={onToggle} />
      <section className="detail-surface visit-location" aria-label="مکان و شرایط ثبت‌شده">
        <h3><Icon name="pin" />مکان و شرایط ثبت‌شده</h3>
        <dl><dt>نشانی</dt><dd>{recordedText(shop.address)}</dd><dt>محدوده</dt><dd>{recordedText(shop.location_label)}</dd>
          <dt>مختصات</dt><dd>{recordedNumber(shop.lat)}، {recordedNumber(shop.lon)}</dd>
          <dt>پرداخت ثبت‌شده</dt><dd>{recordedPayments(plan.recorded_payment_options)}</dd>
          <dt>گارانتی ثبت‌شده</dt><dd>{recordedText(plan.recorded_warranty)}؛ وضعیت تأیید نامشخص</dd>
          <dt>سیاست بازگشت فروشگاه</dt><dd>نامشخص؛ ترجیح درخواستی تو، سیاست فروشگاه نیست.</dd>
          <dt>آخرین تغییر قیمت</dt><dd>{recordedTimestamp(plan.last_price_changed_at)}؛ زمان تغییر قیمت، زمان تأیید موجودی نیست.</dd>
        </dl>
        <details><summary>ساعت کاری اعلام‌شده</summary><p>{plan.opening_hours_status === 'recorded_unverified' ? 'ساعت‌ها ثبت شده‌اند و تأیید نشده‌اند.' : plan.opening_hours_status === 'unsupported' ? 'ساختار ساعت‌های ثبت‌شده قابل تفسیر نیست.' : 'ساعت کاری نامشخص است.'} باز بودن فعلی فروشگاه مشخص نیست.</p>
          <ul>{recordedHours(plan.recorded_weekly_hours).map(day => <li key={day.day}>{day.label}: <bdi>{day.hours}</bdi></li>)}</ul>
        </details>
        <p className="muted">فاصلهٔ نمایش‌داده‌شده مستقیم است؛ مسافت خیابانی یا زمان سفر نیست.</p>
      </section>
    </div><section className="detail-surface" aria-labelledby="verification-questions-title">
      <h3 id="verification-questions-title">سؤال‌های پیش از خرید</h3><span className="pending-badge">در انتظار بررسی تو</span>
      <PersonalReminders plan={plan} />
      <p className="uncertainty-note">تماسی با فروشنده انجام نشده است. هویت فروشگاه ساختگی یا تأییدنشده و اطلاعات تماس این منبع ساختگی است؛ برای تماس مناسب نیست. علامت‌های شخصی، موجودی یا هیچ‌یک از شرایط را تأیید نمی‌کنند.</p>
      <details className="offer-record-details"><summary>شناسه‌ها و هشدارهای برنامه</summary><dl>
        <dt>داده</dt><dd><bdi>{entry.key.dataset_id}</bdi></dd><dt>کالا</dt><dd><bdi>{plan.product_id}</bdi></dd>
        <dt>آفر</dt><dd><bdi>{plan.offer_id}</bdi></dd><dt>فروشگاه</dt><dd><bdi>{plan.shop_id}</bdi></dd>
      </dl><ul>{plan.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>
      <a className="outline-action" href="#results">بازگشت به پیشنهادها</a>
    </section></div>
  </>
}
