import { useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import type { PaymentMethod } from '../contracts'
import type { CriteriaDraft, FieldErrors } from './criteria'
import { Icon } from '../shell/Icon'

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
  const preferences = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (!Object.keys(errors).length) return
    if (errors.paymentMethods || errors.warranty || errors.returnDays) {
      if (preferences.current) preferences.current.open = true
    }
    const frame = requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [errors])
  const attributes = (field: keyof CriteriaDraft, help?: string) => ({
    id: `criteria-${field}`, 'aria-invalid': Boolean(errors[field]),
    'aria-describedby': [help, errors[field] ? `error-${field}` : ''].filter(Boolean).join(' ') || undefined,
  })
  const error = (field: keyof CriteriaDraft) => errors[field] && <span className="field-error" id={`error-${field}`}>{errors[field]}</span>
  const textField = (field: 'query' | 'budget' | 'latitude' | 'longitude' | 'radius' | 'returnDays', label: string, inputMode: 'text' | 'decimal' | 'numeric' = 'decimal') => (
    <div className={`form-field field-${field}`}>
      <label htmlFor={`criteria-${field}`}>{label}</label>
      <div className="input-wrap">
        <input {...attributes(field, field === 'latitude' || field === 'longitude' ? 'location-help' : field === 'budget' ? 'budget-help' : undefined)} name={field} value={draft[field]} inputMode={inputMode}
          dir={field === 'query' ? 'auto' : 'ltr'} autoComplete="off"
          onChange={event => onChange({ ...draft, [field]: event.target.value })} />
        {field === 'query' && <Icon name="search" />}
      </div>
      {error(field)}
    </div>
  )
  function submit(event: FormEvent) {
    event.preventDefault()
    onSubmit()
  }
  return <form ref={form} className="criteria-form" noValidate onSubmit={submit} aria-labelledby="criteria-title">
    <h2 id="criteria-title" className="visually-hidden">معیارهای خرید</h2>
    <div className="criteria-grid">
      {textField('query', 'نام کالا', 'text')}
      <div className="budget-fields">
        {textField('budget', 'حداکثر بودجه')}
        <div className="form-field field-unit">
          <label htmlFor="criteria-priceUnit">واحد بودجه</label>
          <select {...attributes('priceUnit')} value={draft.priceUnit} onChange={event => {
            const value = event.target.value
            if (value === '' || value === 'TOMAN' || value === 'IRR') onChange({ ...draft, priceUnit: value })
          }}>
            <option value="">واحد</option><option value="TOMAN">تومان</option><option value="IRR">ریال</option>
          </select>{error('priceUnit')}
        </div>
        <p id="budget-help" className="field-help">مبلغ بدون جداکنندهٔ هزارگان</p>
      </div>
      <div className="location-fields">
        {textField('latitude', 'عرض جغرافیایی محل انتخابی')}
        {textField('longitude', 'طول جغرافیایی محل انتخابی')}
        <p id="location-help" className="field-help">مختصات محل دلخواهت را وارد کن؛ مکان خودکار دریافت نمی‌شود.</p>
      </div>
      {textField('radius', 'شعاع جست‌وجو (کیلومتر، اختیاری)')}
    </div>
    <div className="criteria-actions">
      <details ref={preferences} className="purchase-preferences">
        <summary><span>ترجیحات خرید <small>(اختیاری)</small></span><Icon name="chevron" /></summary>
        <div className="preferences-grid">
          <fieldset {...attributes('paymentMethods')} tabIndex={-1}>
            <legend>روش پرداخت</legend>
            <div className="payment-options">{paymentOptions.map(([method, label]) => <label key={method}>
              <input type="checkbox" value={method} checked={draft.paymentMethods.includes(method)} onChange={event => onChange({
                ...draft, paymentMethods: event.target.checked ? [...draft.paymentMethods, method] : draft.paymentMethods.filter(item => item !== method),
              })} />{label}
            </label>)}</div>{error('paymentMethods')}
          </fieldset>
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
      </details>
      <button className="primary-button search-submit" type="submit" disabled={loading}><Icon name="search" />{loading ? 'در حال جست‌وجو…' : 'دیدن پیشنهادها'}</button>
    </div>
    <p className="form-limitation"><Icon name="info" />قیمت و موجودی را پیش از مراجعه بررسی کن.</p>
  </form>
}
