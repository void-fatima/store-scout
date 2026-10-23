import { useId, useState } from 'react'
import type { FollowupPlan } from '../../contracts'
import type { ResponseEntry } from '../../journey/operations'
import { recordedHours, recordedNumber, recordedPayments, recordedText, recordedTimestamp } from '../../journey/comparison/recordedValues'
import { Icon } from '../../shell/Icon'

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

export function VerificationQuestions({ entry, plan }: { entry: ResponseEntry; plan: FollowupPlan }) {
  const headingId = useId()
  return <section className="verification-content" aria-labelledby={headingId}>
    <h3 id={headingId}>سؤال‌های پیش از خرید</h3><span className="pending-badge">در انتظار بررسی تو</span>
      <PersonalReminders plan={plan} />
      <p className="uncertainty-note">تماسی با فروشنده انجام نشده است. هویت فروشگاه ساختگی یا تأییدنشده و اطلاعات تماس این منبع ساختگی است؛ برای تماس مناسب نیست. علامت‌های شخصی، موجودی یا هیچ‌یک از شرایط را تأیید نمی‌کنند.</p>
      <details className="offer-record-details"><summary>شناسه‌ها و هشدارهای برنامه</summary><dl>
        <dt>داده</dt><dd><bdi>{entry.key.dataset_id}</bdi></dd><dt>کالا</dt><dd><bdi>{plan.product_id}</bdi></dd>
        <dt>آفر</dt><dd><bdi>{plan.offer_id}</bdi></dd><dt>فروشگاه</dt><dd><bdi>{plan.shop_id}</bdi></dd>
      </dl><ul>{plan.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>
  </section>
}

export function RecordedVisitConditions({ entry, plan }: { entry: ResponseEntry; plan: FollowupPlan }) {
  const { shop } = entry.result.candidate
  return <section className="detail-surface visit-location" aria-label="مکان و شرایط ثبت‌شده">
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
}
