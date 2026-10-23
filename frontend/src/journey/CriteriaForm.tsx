import { useRef } from 'react'
import type { FormEvent } from 'react'
import type { PaymentMethod } from '../contracts'
import type { CriteriaDraft, FieldErrors } from './criteria'

type Props = {
  draft: CriteriaDraft
  errors: FieldErrors
  loading: boolean
  onChange: (draft: CriteriaDraft) => void
  onSubmit: () => void
}
const paymentOptions: readonly [PaymentMethod, string][] = [['cash', 'نقدی'], ['card', 'کارت'], ['installments', 'اقساط']]

export function CriteriaForm({ draft, errors, loading, onChange, onSubmit }: Props) {
  const form = useRef<HTMLFormElement>(null)
  const attributes = (field: keyof CriteriaDraft) => ({
    id: `criteria-${field}`, 'aria-invalid': Boolean(errors[field]),
    ...(errors[field] ? { 'aria-describedby': `error-${field}` } : {}),
  })
  const error = (field: keyof CriteriaDraft) => errors[field] && <span className="field-error" id={`error-${field}`}>{errors[field]}</span>
  const textField = (field: 'query' | 'budget' | 'latitude' | 'longitude' | 'radius' | 'returnDays', label: string, inputMode: 'text' | 'decimal' | 'numeric' = 'decimal') => (
    <div className="form-field">
      <label htmlFor={`criteria-${field}`}>{label}</label>
      <input {...attributes(field)} name={field} value={draft[field]} inputMode={inputMode}
        dir={field === 'query' ? 'auto' : 'ltr'} autoComplete="off"
        onChange={event => onChange({ ...draft, [field]: event.target.value })} />
      {error(field)}
    </div>
  )
  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
    // Validation updates the controlled errors during this event. Focus after React commits.
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  }
  return <form ref={form} className="criteria-form" noValidate onSubmit={submit} aria-labelledby="criteria-title">
    <h2 id="criteria-title">معیارهای خرید</h2>
    <p className="muted" id="location-help">مختصات محل انتخابی خود را وارد کنید؛ مکان شما به‌صورت خودکار حدس زده نمی‌شود.</p>
    <div className="form-grid">
      {textField('query', 'نام کالا', 'text')}
      {textField('budget', 'حداکثر بودجه')}
      <div className="form-field">
        <label htmlFor="criteria-priceUnit">واحد بودجه</label>
        <select {...attributes('priceUnit')} value={draft.priceUnit} onChange={event => {
          const value = event.target.value
          if (value === '' || value === 'TOMAN' || value === 'IRR') onChange({ ...draft, priceUnit: value })
        }}>
          <option value="">انتخاب کنید</option><option value="TOMAN">تومان</option><option value="IRR">ریال</option>
        </select>{error('priceUnit')}
      </div>
      {textField('latitude', 'عرض جغرافیایی محل انتخابی')}
      {textField('longitude', 'طول جغرافیایی محل انتخابی')}
      {textField('radius', 'شعاع جست‌وجو (کیلومتر، اختیاری)')}
    </div>
    <fieldset>
      <legend>ترجیحات خرید (اختیاری)</legend>
      <fieldset {...attributes('paymentMethods')}>
        <legend>روش پرداخت</legend>
        <div className="payment-options">{paymentOptions.map(([method, label]) => <label key={method}>
          <input type="checkbox" value={method} checked={draft.paymentMethods.includes(method)} onChange={event => onChange({
            ...draft, paymentMethods: event.target.checked ? [...draft.paymentMethods, method] : draft.paymentMethods.filter(item => item !== method),
          })} />{label}
        </label>)}</div>{error('paymentMethods')}
      </fieldset>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="criteria-warranty">گارانتی</label>
          <select {...attributes('warranty')} value={draft.warranty} onChange={event => {
            const value = event.target.value
            if (value === '' || value === 'yes' || value === 'no') onChange({ ...draft, warranty: value })
          }}><option value="">بدون ترجیح</option><option value="yes">دارای گارانتی</option><option value="no">بدون گارانتی</option></select>
          {error('warranty')}
        </div>
        {textField('returnDays', 'مهلت بازگشت (روز، اختیاری)', 'numeric')}
      </div>
    </fieldset>
    <button className="primary-button" type="submit" disabled={loading}>{loading ? 'در حال جست‌وجو…' : 'جست‌وجوی پیشنهادها'}</button>
  </form>
}
