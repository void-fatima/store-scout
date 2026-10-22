import type { JourneyRecommendations, JourneySearchCriteria, ShoppingCriteria, ShoppingRequest } from '../contracts'

/** Compare decimal representations without converting the monetary value to float. */
function moneyIdentity(value: string | number | null | undefined): string | null {
  if (value == null || (typeof value === 'number' && !Number.isSafeInteger(value))) return null
  const match = /^\+?(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(String(value).trim())
  if (!match?.[1]) return null
  const fraction = match[2] ?? ''
  const exponent = Number(match[3] ?? '0') - fraction.length
  if (!Number.isSafeInteger(exponent)) return null
  const digits = `${match[1]}${fraction}`.replace(/^0+/, '')
  if (!digits) return '0'
  const coefficient = digits.replace(/0+$/, '')
  return `${coefficient}e${exponent + digits.length - coefficient.length}`
}

function projection(criteria: JourneySearchCriteria) {
  const preferences = criteria.preferred_purchase_conditions
  return {
    query: criteria.q?.trim() ?? null,
    budget: moneyIdentity(criteria.max_price_toman ?? criteria.max_budget),
    unit: criteria.max_price_toman == null ? criteria.price_unit : 'TOMAN',
    latitude: criteria.latitude ?? null, longitude: criteria.longitude ?? null,
    radius: criteria.max_distance_km ?? null,
    preferences: preferences ? {
      payment: preferences.payment_methods ?? null, warranty: preferences.warranty_available ?? null,
      returns: preferences.return_window_days ?? null,
    } : null,
    time: criteria.shopping_time ? Date.parse(criteria.shopping_time) : null,
  }
}

function originalProjection(criteria: ShoppingCriteria) {
  return projection({ q: criteria.query, max_budget: criteria.max_budget, price_unit: criteria.price_unit,
    latitude: criteria.latitude ?? null, longitude: criteria.longitude ?? null,
    max_distance_km: criteria.max_distance_km ?? null,
    preferred_purchase_conditions: criteria.preferred_purchase_conditions ?? null,
    shopping_time: criteria.shopping_time ?? null,
  })
}

export function responseMatchesRequest(response: JourneyRecommendations, request: ShoppingRequest): boolean {
  if (!request.criteria || !response.state.criteria) return false
  const submitted = projection(request.criteria)
  return submitted.budget !== null
    && JSON.stringify(submitted) === JSON.stringify(projection(response.state.criteria))
    && JSON.stringify(submitted) === JSON.stringify(originalProjection(response.result.original_constraints))
}
