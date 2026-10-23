import { useState } from 'react'
import type { FormEvent } from 'react'
import type { IntentFields, IntentPatch } from '../../contracts/intent'
import { SearchLocationPicker } from './SearchLocationPicker'
import { validPoint } from './locationPoint'
import { scalarFields } from './fields'

export function IntentEditor({ fields, disabled, onEdit, onSubmit }: { fields: IntentFields; disabled: boolean;
  onEdit: () => void; onSubmit: (changes: IntentPatch) => void }) {
  const [values, setValues] = useState(() => Object.fromEntries(scalarFields.map(([field]) => [field, fields[field] ?? ''])))
  const [coordinates, setCoordinates] = useState(fields.coordinates ?? null)
  const [coordinatesChanged, setCoordinatesChanged] = useState(false)
  const [bindingInvalid, setBindingInvalid] = useState(!!fields.coordinates && (fields.coordinates.for_location ?? null) !== (fields.location ?? null))
  const [radius, setRadius] = useState(fields.radius ?? '')
  const [preferences, setPreferences] = useState((fields.other_preferences ?? []).join('\n'))
  const [error, setError] = useState<string | null>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    const changes: IntentPatch = {}
    for (const [field] of scalarFields) if (values[field] !== (fields[field] ?? '')) changes[field] = values[field]?.trim() || null
    if (radius !== (fields.radius ?? '')) changes.radius = radius.trim() || null
    if (preferences !== (fields.other_preferences ?? []).join('\n')) {
      const list = preferences.split('\n').map(value => value.trim()).filter(Boolean)
      if (list.length > 5 || list.some(value => value.length > 200)) { setError('حداکثر پنج ترجیح، هر کدام تا ۲۰۰ نویسه، وارد کن.'); return }
      changes.other_preferences = list as NonNullable<IntentPatch['other_preferences']>
    }
    if (bindingInvalid) changes.coordinates = null
    else if (coordinatesChanged) {
      if (coordinates && (!validPoint(coordinates) || (coordinates.for_location ?? null) !== (values.location?.trim() || null))) {
        setError('مکان را برای نام محدودهٔ فعلی دوباره تأیید کن.'); return
      }
      changes.coordinates = coordinates
    }
    if (!Object.keys(changes).length) { setError('هنوز معیاری را تغییر نداده‌ای.'); return }
    setError(null); onSubmit(changes)
  }
  return <form className="intent-editor" onSubmit={submit}>
    <fieldset disabled={disabled}><legend>تکمیل یا اصلاح معیارها</legend>
      <SearchLocationPicker value={coordinates} location={values.location?.trim() || null} invalidBinding={bindingInvalid}
        disabled={disabled} onChange={point => { setCoordinates(point); setCoordinatesChanged(true); setBindingInvalid(false); setError(null); onEdit() }} />
      <div className="intent-editor__grid">
        <label>شعاع جست‌وجو با واحد<input maxLength={200} value={radius} placeholder="مثلاً ۵ کیلومتر" onChange={event => { setRadius(event.target.value); onEdit() }} /></label>
      </div>
      <details><summary>اصلاح سایر معیارها و حذف محدودیت‌های پشتیبانی‌نشده</summary>
        <p>خالی‌کردن یک معیار یعنی درخواست حذف صریح همان معیار. شرط اجباری را فقط با انتخاب خودت به ترجیح تبدیل کن؛ هیچ شرطی خودکار کنار گذاشته نمی‌شود.</p>
        <div className="intent-editor__grid">{scalarFields.map(([field, label]) => <label key={field}>{label}<input maxLength={200} value={values[field] ?? ''} onChange={event => {
          if (field === 'location' && coordinates && event.target.value.trim() !== (values.location?.trim() || '')) setBindingInvalid(true)
          setValues({ ...values, [field]: event.target.value }); onEdit()
        }} /></label>)}</div>
        <label>سایر ترجیح‌ها؛ هر خط یک مورد<textarea value={preferences} onChange={event => { setPreferences(event.target.value); onEdit() }} /></label>
      </details>
      {error && <p role="alert">{error}</p>}
      <button className="secondary-button" type="submit">ثبت اصلاح معیارها</button>
    </fieldset>
  </form>
}
