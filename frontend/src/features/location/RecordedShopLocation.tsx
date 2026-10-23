import { useId } from 'react'
import type { CatalogContext, OfferCandidate } from '../../contracts'
import { recordedPosition } from './mapUrls'
import './recordedShopLocation.css'

export interface RecordedShopLocationProps {
  shop: OfferCandidate['shop']
  context: CatalogContext
}

const text = (value: string | null | undefined, fallback: string) => value?.trim() ? value : fallback
const noticeMessages: Readonly<Record<string, string>> = {
  offer_does_not_confirm_stock: 'آفر ثبت‌شده، موجودی فعلی را تأیید نمی‌کند.',
  price_timestamp_is_last_change_not_last_verification: 'زمان قیمت، آخرین تغییر است؛ زمان تأیید قیمت یا موجودی نیست.',
  shop_names_synthetic_or_unverified: 'نام فروشگاه‌ها ساختگی یا تأییدنشده است.',
  contact_numbers_synthetic: 'شماره‌های تماس ساختگی‌اند.',
  tehran_coverage_incomplete: 'پوشش داده‌های تهران کامل نیست.',
}

/** Read-only recorded data. The caller owns association with its current result. */
export function RecordedShopLocation({ shop, context }: RecordedShopLocationProps) {
  const prefix = useId()
  const position = recordedPosition(shop)
  const dataset = context.dataset
  const source = dataset?.source_kind === 'sample' ? 'داده‌های نمونه و ساختگی'
    : dataset?.source_kind === 'provided' ? 'داده‌های واردشده؛ هویت تأیید نشده' : 'منبع داده نامشخص'
  return <section className="recorded-shop-location" dir="rtl" lang="fa" aria-labelledby={`${prefix}-title`}>
    <header className="recorded-shop-location__heading">
      <span className="recorded-shop-location__symbol" aria-hidden="true">⌖</span>
      <div><h3 id={`${prefix}-title`}>مکان ثبت‌شدهٔ فروشگاه</h3>
        <p>{text(shop.name, 'نام فروشگاه ثبت نشده است')}</p></div>
      <span className="recorded-shop-location__badge">تأیید نشده</span>
    </header>
    <dl className="recorded-shop-location__facts">
      <div><dt>نشانی ثبت‌شده</dt><dd>{text(shop.address, 'نشانی ثبت نشده است')}</dd></div>
      {shop.location_label?.trim() && <div><dt>محدودهٔ ثبت‌شده</dt><dd>{shop.location_label}</dd></div>}
      <div><dt>مختصات ثبت‌شده</dt><dd>{position ? <span className="recorded-shop-location__coordinates">
        <span>عرض: <bdi dir="ltr">{position.lat}</bdi></span><span>طول: <bdi dir="ltr">{position.lon}</bdi></span>
      </span> : 'مختصات معتبر و کامل در دسترس نیست؛ نقشه نمایش داده نمی‌شود.'}</dd></div>
    </dl>
    {position && <>
      {position.embed ? <>
        <p id={`${prefix}-map-help`} className="recorded-shop-location__help">نقشهٔ تعاملی OpenStreetMap؛ می‌توانی نقشه را جابه‌جا یا بزرگ‌نمایی کنی.</p>
        <iframe className="recorded-shop-location__map" key={position.embed} src={position.embed}
          title={`نقشهٔ تعاملی مکان ثبت‌شدهٔ ${text(shop.name, 'فروشگاه')}`}
          aria-describedby={`${prefix}-map-help`} loading="lazy" referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups" />
      </> : <p className="recorded-shop-location__unavailable">مختصات معتبر است، اما نقشهٔ استاندارد OpenStreetMap عرض‌های نزدیک قطب را نمایش نمی‌دهد.</p>}
      <a className="recorded-shop-location__open" href={position.external} target="_blank" rel="noopener noreferrer">
        باز کردن موقعیت ثبت‌شده در OpenStreetMap <span>↗ <span className="recorded-shop-location__new-window">(پنجرهٔ جدید)</span></span>
      </a>
      <p className="recorded-shop-location__help">اگر نقشه بارگیری نشد، نشانی و مختصات بالا و پیوند مستقل همچنان در دسترس‌اند. نمایش نقشه به سرویس خارجی وابسته است.</p>
      <p className="recorded-shop-location__credit">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">مشارکت‌کنندگان OpenStreetMap (پنجرهٔ جدید)</a></p>
    </>}
    <p className="recorded-shop-location__notice">این مکان فقط در داده‌ها ثبت شده است؛ موجودی، هویت فروشنده، باز بودن فروشگاه یا دقت مسیر را تأیید نمی‌کند. مسیر خیابانی و زمان سفر محاسبه نشده‌اند.</p>
    <details className="recorded-shop-location__provenance">
      <summary>منبع و محدودیت‌های مکان</summary>
      <p>{source}</p>
      {dataset?.coverage && <p>پوشش داده‌های تهران محدود است؛ این منبع همهٔ فروشگاه‌ها را پوشش نمی‌دهد.</p>}
      <p>هویت فروشگاه ساختگی یا تأییدنشده است. شماره‌های تماس این منبع ساختگی‌اند و برای تماس مناسب نیستند.</p>
      {dataset && <dl><dt>شناسهٔ داده</dt><dd><bdi>{dataset.dataset_id}</bdi></dd>
        <dt>زمان ورود داده؛ زمان تأیید مکان نیست</dt><dd><bdi>{dataset.imported_at}</bdi></dd></dl>}
      {!!context.notices?.length && <ul>{context.notices.map((notice, index) => <li key={index}>{Object.hasOwn(noticeMessages, notice) ? noticeMessages[notice] : notice}</li>)}</ul>}
    </details>
  </section>
}
