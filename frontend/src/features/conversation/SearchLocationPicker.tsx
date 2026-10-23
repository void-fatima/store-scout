import { useEffect, useId, useRef, useState } from 'react'
import * as L from 'leaflet'
import { validPoint } from './locationPoint'
import type { Coordinates, Point } from './locationPoint'
import { normalizeDigits } from '../../journey/criteria'
import 'leaflet/dist/leaflet.css'
import './searchLocationPicker.css'

const describe = (point: Point) => `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`

/** Only explicit confirmation calls onChange. Exploration is private to Selection. */
export function SearchLocationPicker({ value, location, invalidBinding, disabled, onChange }: {
  value: Coordinates | null; location: string | null; invalidBinding: boolean; disabled: boolean;
  onChange: (point: Coordinates | null) => void;
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const selected = validPoint(value)
  function close() { setOpen(false); trigger.current?.focus() }
  return <section className="search-location" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>مرکز جست‌وجوی من</h3>
    <p>نقطهٔ دلخواهت را انتخاب و تأیید کن. نام محدوده به نشانی یا مختصات تبدیل نمی‌شود.</p>
    <div className="search-location__summary" role="status">
      {selected ? <><strong>{invalidBinding ? 'مکان قبلی نیاز به تأیید دوباره دارد' : 'مکان انتخاب‌شده'}</strong>
        <p>{location ? <>برای محدودهٔ «{location}»</> : 'بدون نام محدوده'} · <bdi dir="ltr">{describe(value)}</bdi></p>
        {invalidBinding && <p>نام محدوده تغییر کرده است؛ مکان قبلی برای این نام معتبر نیست. دوباره انتخاب و تأیید کن، وگرنه با ثبت اصلاح، مرکز قبلی حذف می‌شود.</p>}
      </> : 'هنوز مکانی انتخاب نشده است.'}
    </div>
    <div className="search-location__actions">
      <button ref={trigger} className="secondary-button" type="button" disabled={disabled}
        aria-expanded={open && !disabled} aria-controls={`${id}-selection`} onClick={() => setOpen(!open)}>
        {selected ? 'تغییر مکان' : 'انتخاب محل روی نقشه'}
      </button>
      {selected && <button type="button" className="text-action" disabled={disabled} onClick={() => { setOpen(false); onChange(null) }}>حذف مرکز انتخاب‌شده</button>}
    </div>
    {open && !disabled && <Selection key={location} id={`${id}-selection`} initial={selected ? value : null}
      onCancel={close} onConfirm={point => { onChange({ ...point, for_location: location }); close() }} />}
  </section>
}

function Selection({ id, initial, onCancel, onConfirm }: {
  id: string; initial: Point | null; onCancel: () => void; onConfirm: (point: Point) => void;
}) {
  const [point, setPoint] = useState<Point | null>(initial)
  const [latitude, setLatitude] = useState(initial ? String(initial.latitude) : '')
  const [longitude, setLongitude] = useState(initial ? String(initial.longitude) : '')
  const [manual, setManual] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.Marker | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  // Mount once per exploration session, including StrictMode's setup/cleanup cycle.
  useEffect(() => {
    heading.current?.focus()
    const element = container.current!
    let instance: L.Map | undefined
    let observer: ResizeObserver | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      instance = L.map(element, { scrollWheelZoom: false, worldCopyJump: true })
      map.current = instance
      const center: L.LatLngExpression = initial ? [Math.max(-85, Math.min(85, initial.latitude)), initial.longitude] : [35.7, 51.4]
      instance.setView(center, initial ? 13 : 11)
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      })
      let failed = false
      tiles.on('tileerror', () => { failed = true; clearTimeout(timer); setMapState('failed') })
      tiles.on('load', () => { clearTimeout(timer); if (!failed) setMapState('ready') })
      timer = setTimeout(() => setMapState('failed'), 12000)
      tiles.addTo(instance)
      instance.on('click', (event: L.LeafletMouseEvent) => {
        const latlng = event.latlng.wrap()
        const next = { latitude: latlng.lat, longitude: latlng.lng }
        if (validPoint(next)) { setPoint(next); setManual(false); setError(null) }
      })
      observer = new ResizeObserver(() => instance?.invalidateSize({ pan: false }))
      observer.observe(element)
      instance.invalidateSize({ pan: false })
    } catch {
      setMapState('failed')
      instance?.remove(); instance = undefined; map.current = null
    }
    return () => {
      clearTimeout(timer); observer?.disconnect(); instance?.remove()
      map.current = null; marker.current = null
    }
    // initial is the session's opening value; subsequent points update only the marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    if (!point || Math.abs(point.latitude) > 85.05112878) {
      marker.current?.remove(); marker.current = null; return
    }
    const latlng: L.LatLngExpression = [point.latitude, point.longitude]
    if (marker.current) marker.current.setLatLng(latlng)
    else marker.current = L.marker(latlng, { keyboard: false, interactive: false,
      icon: L.divIcon({ className: 'search-location__marker', iconSize: [24, 24], iconAnchor: [12, 12] }),
    }).addTo(instance)
  }, [point])
  function selectCenter() {
    const center = map.current?.getCenter().wrap()
    if (!center) return
    const next = { latitude: center.lat, longitude: center.lng }
    if (validPoint(next)) { setPoint(next); setManual(false); setError(null) }
  }
  function confirm() {
    let next = point
    if (manual) {
      const lat = normalizeDigits(latitude), lon = normalizeDigits(longitude)
      next = /^-?\d+(?:\.\d+)?$/.test(lat) && /^-?\d+(?:\.\d+)?$/.test(lon)
        ? { latitude: Number(lat), longitude: Number(lon) } : null
      if (!validPoint(next)) { setError('هر دو مختصات را معتبر وارد کن؛ عرض بین ۹۰- تا ۹۰ و طول بین ۱۸۰- تا ۱۸۰.'); return }
    }
    if (!validPoint(next)) { setError('ابتدا یک نقطه را انتخاب کن؛ نمای اولیهٔ نقشه انتخاب تو نیست.'); return }
    onConfirm(next)
  }
  return <div id={id} className="search-location__selection" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel() }
  }}>
    <h4 ref={heading} tabIndex={-1}>انتخاب مرکز جست‌وجو</h4>
    <p id={`${id}-help`}>روی نقشه بزن؛ یا با Tab وارد نقشه شو، با کلیدهای جهت جابه‌جا کن و با Enter نقطهٔ وسط را انتخاب کن. کلیدهای + و − برای بزرگ‌نمایی‌اند. با Tab خارج شو یا با Escape لغو کن.</p>
    <p>{initial ? 'نمای نقشه مکان قبلی را نشان می‌دهد؛ تغییر نما مکان انتخاب‌شده را عوض نمی‌کند.' : 'نمای اولیهٔ تهران فقط برای مرور است؛ هیچ مکانی خودکار انتخاب نمی‌شود.'}</p>
    <div className="search-location__map-frame">
      <div ref={container} className="search-location__map" tabIndex={0} role="region" aria-label="نقشهٔ انتخاب مرکز جست‌وجو"
        aria-describedby={`${id}-help`} dir="ltr" onKeyDown={event => {
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault(); event.stopPropagation(); selectCenter()
          }
        }} />
      <span className="search-location__crosshair" aria-hidden="true">+</span>
    </div>
    <p role="status">{mapState === 'loading' ? 'در حال بارگیری نقشه؛ ورود دستی هم در دسترس است.'
      : mapState === 'failed' ? 'نقشه یا بخشی از تصویر آن در دسترس نیست؛ از ورود دستی مختصات استفاده کن.' : 'نقشه آمادهٔ انتخاب است.'}</p>
    <button className="secondary-button" type="button" disabled={mapState === 'failed'} onClick={selectCenter}>انتخاب نقطهٔ وسط نما</button>
    <p role="status">{manual ? 'مختصات دستی در انتظار تأیید است.' : point ? <>نقطهٔ در انتظار تأیید: <bdi dir="ltr">{describe(point)}</bdi></> : 'هنوز نقطه‌ای انتخاب نکرده‌ای.'}</p>
    {point && Math.abs(point.latitude) > 85.05112878 && <p>این نقطه نزدیک قطب است و نقشه نمی‌تواند آن را نمایش دهد؛ مختصات دقیق حفظ شده است.</p>}
    <details><summary>ورود دستی مختصات (پیشرفته / دسترس‌پذیری)</summary>
      <p>اگر نقشه در دسترس نیست، هر دو عدد را وارد کن و «تأیید این مکان» را بزن. صفر معتبر است.</p>
      <div className="search-location__coordinates">
        <label>عرض مرکز جست‌وجوی من<input inputMode="decimal" dir="ltr" value={manual ? latitude : point ? String(point.latitude) : ''}
          onChange={event => { if (!manual) setLongitude(point ? String(point.longitude) : ''); setLatitude(event.target.value); setManual(true); setError(null) }} /></label>
        <label>طول مرکز جست‌وجوی من<input inputMode="decimal" dir="ltr" value={manual ? longitude : point ? String(point.longitude) : ''}
          onChange={event => { if (!manual) setLatitude(point ? String(point.latitude) : ''); setLongitude(event.target.value); setManual(true); setError(null) }} /></label>
      </div>
    </details>
    {error && <p role="alert">{error}</p>}
    <div className="search-location__actions">
      <button className="primary-button" type="button" onClick={confirm}>تأیید این مکان</button>
      <button className="secondary-button" type="button" onClick={onCancel}>لغو انتخاب مکان</button>
    </div>
    <p className="conversation__help">تأیید مکان فقط ویرایش محلی است. برای ذخیره «ثبت اصلاح معیارها» را بزن؛ جست‌وجو به تأیید دوبارهٔ خلاصه نیاز دارد.</p>
  </div>
}
