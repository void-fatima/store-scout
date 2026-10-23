import { useEffect, useId, useRef, useState } from 'react'
import type { IntentClient } from '../../api/intent'
import { executableIntent } from '../../api/intent'
import type { useJourneyController } from '../../journey/useJourneyController'
import { IntentEditor } from './IntentEditor'
import { scalarFields } from './fields'
import { useConversation } from './useConversation'
import './conversation.css'

const number = (value: number) => new Intl.NumberFormat('fa-IR').format(value)
const statuses = { needs_clarification: 'نیاز به توضیح بیشتر', awaiting_confirmation: 'آمادهٔ بازبینی و تأیید',
  confirmed: 'نسخه تأیید شده است', rejected: 'پیش‌نویس رد شده است', invalid: 'پیام نیاز به بازنویسی دارد' }

export function Conversation({ controller, client }: { controller: ReturnType<typeof useJourneyController>; client?: IntentClient }) {
  const flow = useConversation(controller, client)
  const { state } = flow
  const [message, setMessage] = useState('')
  const [messageError, setMessageError] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousBusy = useRef(state.busy)
  const previousEdit = useRef(state.editKey)
  const prefix = useId()
  useEffect(() => {
    if (previousEdit.current !== state.editKey) { setMessage(''); setMessageError(null); previousEdit.current = state.editKey }
    if (previousBusy.current && !state.busy && !state.completed && !heading.current?.closest('[hidden], details:not([open])')) heading.current?.focus()
    previousBusy.current = state.busy
  }, [state.busy, state.completed, state.editKey])
  const view = state.draft
  const disabled = !!state.busy || state.expired || state.blocked
  return <section className="conversation" aria-labelledby={`${prefix}-title`} aria-busy={!!state.busy}>
    <header><h2 id={`${prefix}-title`} ref={heading} tabIndex={-1}>از نیازت بگو</h2>
      <p>پیامت به یک پیش‌نویس تبدیل می‌شود. تا خلاصهٔ همین نسخه را صریح تأیید نکنی، جست‌وجویی انجام نمی‌شود.</p></header>
    <form onSubmit={event => {
      event.preventDefault()
      if (!message.trim() || [...message].length > 2000) { setMessageError('یک پیام از ۱ تا ۲۰۰۰ نویسه وارد کن.'); return }
      setMessageError(null)
      if (view) void flow.revise({ message: message.trim() })
      else void flow.create(message.trim())
    }}>
      <label htmlFor={`${prefix}-message`}>{view ? 'پاسخ یا توضیح تکمیلی من' : 'پیام خرید من'}</label>
      <textarea id={`${prefix}-message`} value={message} disabled={disabled} maxLength={2000} rows={3}
        placeholder="مثلاً گوشی سامسونگ تا ۳۰ میلیون تومان" aria-describedby={`${prefix}-message-help`}
        onChange={event => { setMessage(event.target.value); if (view) flow.touch() }} />
      <p id={`${prefix}-message-help`} className="conversation__help">واحد بودجه و اندازهٔ شعاع را روشن بنویس. «تأیید می‌کنم» در متن پیام، تأیید پیش‌نویس نیست.</p>
      {messageError && <p role="alert">{messageError}</p>}
      <button type="submit" className="primary-button" disabled={disabled || !message.trim()}>{view ? 'ارسال توضیح و ساخت نسخهٔ تازه' : 'تفسیر پیام و ساخت پیش‌نویس'}</button>
    </form>
    {state.busy && <p role="status">{state.busy}…</p>}
    {state.error && <p role="alert" className="conversation__error">{state.error}</p>}
    {state.expired && <p role="alert">زمان این پیش‌نویس پایان یافته است. برای ادامه گفت‌وگوی تازه‌ای آغاز کن.</p>}
    {view && <>
      <div className="conversation__status"><strong>{statuses[view.status]}</strong><span>نسخهٔ {number(view.revision)}</span></div>
      {view.next_question && <div className="conversation__question"><h3>برای ادامه روشن کن</h3><p>{view.next_question}</p></div>}
      {!!view.issues.length && <ul className="conversation__issues">{view.issues.map((issue, index) => <li key={index}>{issue.question}</li>)}</ul>}
      <section className="conversation__review" aria-labelledby={`${prefix}-summary`}>
        <h3 id={`${prefix}-summary`}>خلاصهٔ برداشت سرویس برای بازبینی</h3>
        {view.summary.length ? <dl>{view.summary.map((line, index) => <div key={index}><dt>{line.label}</dt><dd>{line.value}</dd></div>)}</dl>
          : <p>هنوز خلاصهٔ قابل جست‌وجویی آماده نیست.</p>}
        <ul>{view.notices.map((notice, index) => <li key={index}>{notice}</li>)}</ul>
        <p className="conversation__help">تطبیق نام کالا، تأیید کاربرد فنی نیست. گارانتی و اقساط ترجیح‌اند؛ موجودی، قیمت فعلی و شرایط فروش هنوز تأیید نشده‌اند.</p>
      </section>
      <details className="conversation__evidence"><summary>برداشت اولیه و منبع معیارها</summary>
        <dl>{scalarFields.map(([field, label]) => view.fields[field] != null ? <div key={field}><dt>{label}</dt><dd>{view.fields[field]}
          {view.provenance[field] && <p className="conversation__help">{view.provenance[field]?.source === 'user_supplied' ? 'ورود مستقیم تو' : 'برداشت مدل از متن تو'}: {view.provenance[field]?.evidence}</p>}</dd></div> : null)}</dl>
        {!!view.fields.other_preferences?.length && <ul>{view.fields.other_preferences.map((value, index) => <li key={index}>{value}</li>)}</ul>}
      </details>
      <IntentEditor key={`${view.draft_id}-${view.revision}-${state.editKey}`} fields={view.fields} disabled={disabled} onEdit={flow.touch} onSubmit={changes => { void flow.revise({ changes }) }} />
      {state.dirty && <div className="conversation__question"><p>ویرایش ارسال‌نشده داری؛ تأیید نسخهٔ قبلی بسته است.</p>
        <button type="button" className="secondary-button" disabled={!!state.busy} onClick={flow.discardLocal}>کنار گذاشتن ویرایش ارسال‌نشده</button></div>}
      {executableIntent(view) && <div className="conversation__confirm">
        <label className="intent-check"><input type="checkbox" checked={state.consent} disabled={disabled || state.dirty}
          onChange={event => flow.setConsent(event.target.checked)} />خلاصهٔ نسخهٔ {number(view.revision)} را خوانده‌ام و همین معیارها را برای جست‌وجو تأیید می‌کنم.</label>
        <button type="button" className="primary-button" disabled={disabled || state.dirty || !state.consent} onClick={() => { void flow.confirm() }}>تأیید این نسخه و دیدن پیشنهادها</button>
      </div>}
      {state.completed && controller.state.status === 'ready' && <p role="status">پیشنهادهای کاتالوگ دریافت شدند. <a href="#results">دیدن نتیجهٔ جست‌وجو</a></p>}
      <div className="conversation__actions">
        <button type="button" className="secondary-button" disabled={!!state.busy || state.expired} onClick={() => { void flow.refresh() }}>بازیابی نسخهٔ فعلی</button>
        <button type="button" className="secondary-button" disabled={disabled || view.status === 'rejected'} onClick={() => { void flow.reject() }}>رد این پیش‌نویس</button>
      </div>
    </>}
    {(view || state.busy) && <button type="button" className="text-action" onClick={flow.reset}>گفت‌وگوی تازه و کنار گذاشتن نتیجهٔ قبلی</button>}
    <p className="conversation__help">این گفت‌وگو در همین صفحه نگه داشته می‌شود؛ پس از بارگذاری دوباره باید از نو شروع کنی. جست‌وجوی فرم همچنان مستقل در دسترس است.</p>
  </section>
}
