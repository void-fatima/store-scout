import { expect, it } from 'vitest'
import { emptyDraft, fieldErrorsFromApi, normalizeDigits, validateCriteria } from './criteria'

export const validDraft = () => ({ ...emptyDraft(), query: 'گوشی', budget: '۱۷۰۰۰۰۰۰٫۱۲۳۴۵۶۷۸۹',
  priceUnit: 'TOMAN' as const, latitude: '۳۵٫۷', longitude: '٥١٫٤' })

it('normalizes both digit sets while preserving exact decimal budget strings', () => {
  expect(normalizeDigits(' ١۲٣٫۴ ')).toBe('123.4')
  expect(validateCriteria(validDraft())).toMatchObject({ ok: true, criteria: {
    max_budget: '17000000.123456789', price_unit: 'TOMAN', latitude: 35.7, longitude: 51.4,
  } })
})

it('requires explicit query, positive budget, unit and both coordinates', () => {
  expect(validateCriteria(emptyDraft())).toMatchObject({ ok: false, errors: {
    query: expect.any(String), budget: expect.any(String), priceUnit: expect.any(String),
    latitude: expect.any(String), longitude: expect.any(String),
  } })
  for (const budget of ['0', '-2', '1e4', '20,000', 'Infinity']) {
    expect(validateCriteria({ ...validDraft(), budget })).toMatchObject({ ok: false, errors: { budget: expect.any(String) } })
  }
})

it('validates supported radius/preferences without currency conversion or geocoding', () => {
  expect(validateCriteria({ ...validDraft(), radius: '۱۰۱', latitude: '91', returnDays: '1.5' }))
    .toMatchObject({ ok: false, errors: { radius: expect.any(String), latitude: expect.any(String), returnDays: expect.any(String) } })
  expect(validateCriteria({ ...validDraft(), priceUnit: 'IRR', radius: '۵', paymentMethods: ['card'], warranty: 'no', returnDays: '۰' }))
    .toMatchObject({ ok: true, criteria: { max_budget: '17000000.123456789', price_unit: 'IRR', max_distance_km: 5,
      preferred_purchase_conditions: { payment_methods: ['card'], warranty_available: false, return_window_days: 0 } } })
})

it('maps canonical validation paths without displaying upstream text', () => {
  const errors = fieldErrorsFromApi({ error: { code: 'invalid_request', message: 'trace', details: [
    { location: ['body', 'criteria', 'max_budget'], message: 'secret trace' }, { field: 'criteria.latitude/longitude' },
    { location: false },
  ] } })
  expect(Object.keys(errors)).toEqual(['budget', 'latitude', 'longitude'])
  expect(JSON.stringify(errors)).not.toContain('trace')
})
