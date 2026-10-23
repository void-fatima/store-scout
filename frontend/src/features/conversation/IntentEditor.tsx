import { useState } from 'react'
import type { FormEvent } from 'react'
import type { IntentFields, IntentPatch } from '../../contracts/intent'
import { normalizeDigits } from '../../journey/criteria'
import { scalarFields } from './fields'

export function IntentEditor({ fields, disabled, onEdit, onSubmit }: { fields: IntentFields; disabled: boolean;
  onEdit: () => void; onSubmit: (changes: IntentPatch) => void }) {
  const [values, setValues] = useState(() => Object.fromEntries(scalarFields.map(([field]) => [field, fields[field] ?? ''])))
  const [latitude, setLatitude] = useState(fields.coordinates ? String(fields.coordinates.latitude) : '')
  const [longitude, setLongitude] = useState(fields.coordinates ? String(fields.coordinates.longitude) : '')
  const [radius, setRadius] = useState(fields.radius ?? '')
  const [preferences, setPreferences] = useState((fields.other_preferences ?? []).join('\n'))
  const [coordinatesReviewed, setCoordinatesReviewed] = useState(false)
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
    const coordinatesChanged = latitude !== (fields.coordinates ? String(fields.coordinates.latitude) : '')
      || longitude !== (fields.coordinates ? String(fields.coordinates.longitude) : '')
    if (coordinatesChanged) {
      if (!latitude.trim() && !longitude.trim()) changes.coordinates = null
      else {
        const lat = normalizeDigits(latitude), lon = normalizeDigits(longitude)
        if (!/^-?\d+(?:\.\d+)?$/.test(lat) || !/^-?\d+(?:\.\d+)?$/.test(lon)
          || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lon)) > 180) {
          setError('هر دو مختصات را معتبر وارد کن؛ عرض بین ۹۰- تا ۹۰ و طول بین ۱۸۰- تا ۱۸۰.'); return
        }
        if (!coordinatesReviewed) { setError('تأیید کن که این مختصات، محل انتخابی خودت است.'); return }
        changes.coordinates = { latitude: Number(lat), longitude: Number(lon), for_location: values.location?.trim() || null }
      }
    }
    if (!Object.keys(changes).length) { setError('هنوز معیاری را تغییر نداده‌ای.'); return }
    setError(null); onSubmit(changes)
  }
  return <form className="intent-editor" onSubmit={submit}>
    <fieldset disabled={disabled}><legend>تکمیل یا اصلاح معیارها</legend>
      <p>مرکز جست‌وجو را خودت تعیین کن و مختصاتش را وارد کن؛ نام محله به مختصات تبدیل نمی‌شود. هیچ نقطه یا شعاع پیش‌فرضی انتخاب نشده است.</p>
      <div className="intent-editor__grid">
        <label>عرض مرکز جست‌وجوی من<input inputMode="decimal" dir="ltr" value={latitude} onChange={event => { setLatitude(event.target.value); setCoordinatesReviewed(false); onEdit() }} /></label>
        <label>طول مرکز جست‌وجوی من<input inputMode="decimal" dir="ltr" value={longitude} onChange={event => { setLongitude(event.target.value); setCoordinatesReviewed(false); onEdit() }} /></label>
        <label>شعاع جست‌وجو با واحد<input maxLength={200} value={radius} placeholder="مثلاً ۵ کیلومتر" onChange={event => { setRadius(event.target.value); onEdit() }} /></label>
      </div>
      <label className="intent-check"><input type="checkbox" checked={coordinatesReviewed} onChange={event => { setCoordinatesReviewed(event.target.checked); onEdit() }} />این مختصات را از محل انتخابی خودم وارد کرده‌ام.</label>
      <details><summary>اصلاح سایر معیارها و حذف محدودیت‌های پشتیبانی‌نشده</summary>
        <p>خالی‌کردن یک معیار یعنی درخواست حذف صریح همان معیار. شرط اجباری را فقط با انتخاب خودت به ترجیح تبدیل کن؛ هیچ شرطی خودکار کنار گذاشته نمی‌شود.</p>
        <div className="intent-editor__grid">{scalarFields.map(([field, label]) => <label key={field}>{label}<input maxLength={200} value={values[field] ?? ''} onChange={event => { setValues({ ...values, [field]: event.target.value }); onEdit() }} /></label>)}</div>
        <label>سایر ترجیح‌ها؛ هر خط یک مورد<textarea value={preferences} onChange={event => { setPreferences(event.target.value); onEdit() }} /></label>
      </details>
      {error && <p role="alert">{error}</p>}
      <button className="secondary-button" type="submit">ثبت اصلاح معیارها</button>
    </fieldset>
  </form>
}
