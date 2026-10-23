import type { ErrorResponse, JourneySearchCriteria, PaymentMethod, PriceUnit, PurchaseConditions } from '../contracts'

export type CriteriaDraft = {
  query: string
  budget: string
  priceUnit: PriceUnit | ''
  latitude: string
  longitude: string
  radius: string
  paymentMethods: PaymentMethod[]
  warranty: '' | 'yes' | 'no'
  returnDays: string
}
export type FieldErrors = Partial<Record<keyof CriteriaDraft, string>>
export const emptyDraft = (): CriteriaDraft => ({
  query: '', budget: '', priceUnit: '', latitude: '', longitude: '', radius: '',
  paymentMethods: [], warranty: '', returnDays: '',
})

/** Present the confirmed canonical criteria in the existing editable form. */
export function draftFromCriteria(criteria: JourneySearchCriteria): CriteriaDraft {
  return {
    query: criteria.q ?? '', budget: criteria.max_budget == null ? String(criteria.max_price_toman ?? '') : String(criteria.max_budget),
    priceUnit: criteria.max_price_toman == null ? criteria.price_unit ?? '' : 'TOMAN',
    latitude: criteria.latitude == null ? '' : String(criteria.latitude),
    longitude: criteria.longitude == null ? '' : String(criteria.longitude),
    radius: criteria.max_distance_km == null ? '' : String(criteria.max_distance_km),
    paymentMethods: [...(criteria.preferred_purchase_conditions?.payment_methods ?? [])],
    warranty: criteria.preferred_purchase_conditions?.warranty_available == null ? '' : criteria.preferred_purchase_conditions.warranty_available ? 'yes' : 'no',
    returnDays: criteria.preferred_purchase_conditions?.return_window_days == null ? '' : String(criteria.preferred_purchase_conditions.return_window_days),
  }
}

export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) - (digit >= '۰' ? 1776 : 1632)))
    .replace(/٫/g, '.').replace(/−/g, '-').trim()
}

function decimal(value: string): number | null {
  const normalized = normalizeDigits(value)
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function validateCriteria(draft: CriteriaDraft):
  { ok: true; criteria: JourneySearchCriteria } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const q = draft.query.trim()
  if (!/[\p{L}\p{N}]/u.test(q) || q.length > 200) errors.query = 'نام کالا را با حداکثر ۲۰۰ نویسه وارد کنید.'
  const budget = normalizeDigits(draft.budget)
  if (!/^\d+(?:\.\d+)?$/.test(budget) || !/[1-9]/.test(budget)) errors.budget = 'بودجه را به صورت عدد مثبت و بدون جداکنندهٔ هزارگان وارد کنید.'
  if (!draft.priceUnit) errors.priceUnit = 'واحد بودجه را انتخاب کنید.'
  const latitude = decimal(draft.latitude)
  const longitude = decimal(draft.longitude)
  if (latitude === null || latitude < -90 || latitude > 90) errors.latitude = 'عرض جغرافیایی معتبر بین ۹۰- و ۹۰ وارد کنید.'
  if (longitude === null || longitude < -180 || longitude > 180) errors.longitude = 'طول جغرافیایی معتبر بین ۱۸۰- و ۱۸۰ وارد کنید.'
  const radius = draft.radius.trim() ? decimal(draft.radius) : null
  if (draft.radius.trim() && (radius === null || radius <= 0 || radius > 100)) errors.radius = 'شعاع باید بیشتر از صفر و حداکثر ۱۰۰ کیلومتر باشد.'
  const returnDays = draft.returnDays.trim() ? decimal(draft.returnDays) : null
  if (draft.returnDays.trim() && (returnDays === null || !Number.isSafeInteger(returnDays) || returnDays < 0)) errors.returnDays = 'مهلت بازگشت را با تعداد روز کامل و نامنفی وارد کنید.'
  if (Object.keys(errors).length || !draft.priceUnit || latitude === null || longitude === null) return { ok: false, errors }
  const preferences: PurchaseConditions = {}
  const firstMethod = draft.paymentMethods[0]
  if (firstMethod) preferences.payment_methods = [firstMethod, ...draft.paymentMethods.slice(1)]
  if (draft.warranty) preferences.warranty_available = draft.warranty === 'yes'
  if (returnDays !== null) preferences.return_window_days = returnDays
  return { ok: true, criteria: {
    q, max_budget: budget, price_unit: draft.priceUnit, latitude, longitude,
    max_distance_km: radius,
    preferred_purchase_conditions: Object.keys(preferences).length ? preferences : null,
  } }
}

/** Backend paths select fields; untrusted error messages never become UI text. */
export function fieldErrorsFromApi(error: ErrorResponse): FieldErrors {
  const fields: Record<string, keyof CriteriaDraft> = {
    q: 'query', max_budget: 'budget', price_unit: 'priceUnit', latitude: 'latitude', longitude: 'longitude',
    max_distance_km: 'radius', payment_methods: 'paymentMethods', warranty_available: 'warranty', return_window_days: 'returnDays',
  }
  const result: FieldErrors = {}
  for (const detail of error.error.details ?? []) {
    const location: unknown = detail.location ?? detail.loc ?? detail.field
    const parts = typeof location === 'string' ? location.split(/[./]/) : Array.isArray(location) ? location : []
    for (const part of parts) {
      if (typeof part !== 'string') continue
      if (!Object.hasOwn(fields, part)) continue
      const field = fields[part]
      if (field) result[field] = 'این مقدار از سوی سرویس پذیرفته نشد؛ آن را بررسی کنید.'
    }
  }
  return result
}
