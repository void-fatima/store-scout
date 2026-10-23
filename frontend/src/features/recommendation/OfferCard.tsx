import type { ComparisonKey, RecommendationResult } from '../../contracts'
import type { ResponseEntry } from '../../journey/operations'
import { Icon } from '../../shell/Icon'
import { recordedNumber, recordedText, recordedTimestamp } from '../../journey/comparison/recordedValues'
import { ProductVisual } from './ProductVisual'
import { exactMoney, offerHash } from './presentation'

export function OfferFacts({ result }: { result: RecommendationResult }) {
  const { candidate } = result
  return <div className="offer-facts">
    <h3>{candidate.product.persian_title}</h3>
    <p className="offer-model">{[candidate.product.brand_name, candidate.product.model].filter(Boolean).join(' · ') || recordedText(candidate.product.category_name)}</p>
    <p className="offer-shop"><Icon name="store" />{candidate.shop.name}</p>
    <p className="offer-location"><Icon name="pin" />{recordedText(candidate.shop.location_label ?? candidate.shop.address)}</p>
    <p className="offer-distance">{candidate.distance_km == null ? 'فاصلهٔ مستقیم نامشخص' : `${recordedNumber(candidate.distance_km)} کیلومتر · فاصلهٔ مستقیم`}</p>
    <div className="offer-price"><span>قیمت ثبت‌شده</span><strong>{candidate.price_toman == null ? 'نامشخص' : <>{exactMoney(String(candidate.price_toman))} <small>تومان</small></>}</strong></div>
    <p className="price-changed">آخرین تغییر قیمت: {recordedTimestamp(candidate.last_price_changed_at)}</p>
    <p className="unverified"><span aria-hidden="true">●</span> موجودی تأیید نشده</p>
  </div>
}

export function OfferCard({ result, entry, rank, selected = false, selectionDisabled = false, onToggle, detail = false }: {
  result: RecommendationResult; entry?: ResponseEntry | undefined; rank?: number; selected?: boolean
  selectionDisabled?: boolean; onToggle?: ((key: ComparisonKey) => void) | undefined
  detail?: boolean
}) {
  return <article className="offer-card" aria-label={`${result.candidate.product.persian_title}، ${result.candidate.shop.name}`}>
    <div className="offer-card-top">
      {rank !== undefined && <span className="offer-rank" aria-label={`پیشنهاد ${recordedNumber(rank)}`}>{recordedNumber(rank)}</span>}
      {entry && onToggle && <label className="compare-choice"><input type="checkbox" checked={selected} disabled={!selected && selectionDisabled}
        aria-label={`مقایسهٔ ${result.candidate.product.persian_title}، آفر ${entry.key.offer_id}`} onChange={() => onToggle(entry.key)} />مقایسه</label>}
    </div>
    <div className="offer-card-body"><OfferFacts result={result} /><ProductVisual product={result.candidate.product} /></div>
    <details className="offer-reason"><summary><span><Icon name="bulb" />چرا این پیشنهاد؟</span><Icon name="chevron" /></summary>
      <ul>{result.explanation_reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>{reason.message}</li>)}</ul>
    </details>
    <div className="offer-card-actions">
      {entry && !detail && <a className="outline-action" data-offer-action={offerHash('explanation', entry.key)} href={offerHash('explanation', entry.key)}>دلیل این پیشنهاد</a>}
      {!entry && <p className="field-help">شناسهٔ منبع برای انتخاب و مقایسه در دسترس نیست.</p>}
    </div>
  </article>
}
