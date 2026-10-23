import type { ComparisonKey, PriceUnit } from '../../contracts'

/** Display exact decimal strings; only the exponent/position uses Number. No currency conversion. */
export function exactMoney(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value)
  if (!match?.[1]) return value
  const exponent = Number(match[3] ?? '0')
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) return value
  const digits = match[1] + (match[2] ?? '')
  const position = match[1].length + exponent
  const expanded = position <= 0 ? `0.${'0'.repeat(-position)}${digits}`
    : position >= digits.length ? digits + '0'.repeat(position - digits.length)
      : `${digits.slice(0, position)}.${digits.slice(position)}`
  const [integer = '0', fraction] = expanded.split('.')
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')}${fraction === undefined ? '' : `٫${fraction}`}`
    .replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)] ?? digit)
}
export const currencyLabel = (unit: PriceUnit) => unit === 'IRR' ? 'ریال' : 'تومان'

export type OfferView = 'explanation' | 'alternative' | 'checklist'
export function offerHash(view: OfferView, key: ComparisonKey) {
  return `#${view}/${[key.dataset_id, key.product_id, key.offer_id].map(encodeURIComponent).join('/')}`
}
export type PanelRoute = { view: OfferView; key: ComparisonKey } | { view: 'alternatives' } | null
export function parsePanelRoute(hash: string): PanelRoute {
  if (hash === '#alternatives') return { view: 'alternatives' }
  const [view, dataset, product, offer, extra] = hash.slice(1).split('/')
  if (!['explanation', 'alternative', 'checklist'].includes(view ?? '') || !dataset || !product || !offer || extra !== undefined) return null
  try {
    return { view: view as OfferView, key: { dataset_id: decodeURIComponent(dataset), product_id: decodeURIComponent(product), offer_id: decodeURIComponent(offer) } }
  } catch { return null }
}
export function editCriteria() {
  window.location.hash = 'edit-search'
  requestAnimationFrame(() => document.getElementById('criteria-query')?.focus())
}
