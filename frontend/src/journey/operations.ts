import type { AlternativeAcceptance, AlternativesResponse, ComparisonKey, FollowupPlan } from '../contracts'
import { isAlternativeAcceptance, isShoppingRequest } from '../api/validation'
import type { CriteriaDraft } from './criteria'
import { validateCriteria } from './criteria'

/** Order matters for arrays, but JSON object key order does not imply consent. */
export function sameValue(left: unknown, right: unknown, depth = 0): boolean {
  if (Object.is(left, right)) return true
  if (depth > 40 || left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value: unknown, index) => sameValue(value, right[index], depth + 1))
  }
  const a: Record<string, unknown> = Object.fromEntries(Object.entries(left))
  const b: Record<string, unknown> = Object.fromEntries(Object.entries(right))
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameValue(a[key], b[key], depth + 1))
}

export function responseEntries(response: AlternativesResponse): { key: ComparisonKey; plan: FollowupPlan | null }[] {
  const dataset = response.original.context.dataset
  if (!dataset) return []
  return [
    ...response.original.recommendations.map(result => ({
      result, plan: response.original_verification.find(plan => plan.offer_id === result.offer_id
        && plan.product_id === result.product_id && plan.shop_id === result.shop_id) ?? null,
    })),
    ...response.suggestions.map(suggestion => ({ result: suggestion.result, plan: suggestion.verification })),
  ].map(({ result, plan }) => ({
    key: { dataset_id: dataset.dataset_id, product_id: result.product_id, offer_id: result.offer_id }, plan,
  }))
}

export function validComparison(response: AlternativesResponse, keys: readonly ComparisonKey[]): ComparisonKey[] | null {
  if (!Array.isArray(keys) || keys.length > 10) return null
  const entries = responseEntries(response)
  const selected: ComparisonKey[] = []
  for (const key of keys) {
    const entry = entries.find(entry => sameValue(entry.key, key))
    if (!entry || selected.some(item => sameValue(item, entry.key))) return null
    selected.push(entry.key)
  }
  return selected
}

export function acceptedDraft(options: {
  response: AlternativesResponse; acceptance: AlternativeAcceptance
  requestId: string; revision: number; draft: CriteriaDraft
}): CriteriaDraft | null {
  const { response, acceptance, requestId, revision, draft } = options
  if (!isAlternativeAcceptance(acceptance)) return null
  if (acceptance.request_id !== requestId || acceptance.expected_revision !== revision
    || !response.original.context.dataset || acceptance.dataset_id !== response.original.context.dataset.dataset_id) return null
  const suggestion = response.suggestions.find(item => item.result.offer_id === acceptance.offer_id)
  if (!suggestion || !sameValue(suggestion.changes, acceptance.accepted_changes)
    || !sameValue(suggestion.original_constraints, response.original_constraints)
    || suggestion.original_constraints.price_unit !== draft.priceUnit) return null
  const original = suggestion.original_constraints
  const relaxed = suggestion.relaxed_constraints
  const changedFields = Object.keys({ ...original, ...relaxed }).filter(key => !sameValue(
    Object.entries(original).find(([name]) => name === key)?.[1],
    Object.entries(relaxed).find(([name]) => name === key)?.[1],
  ))
  if (!changedFields.length || changedFields.length !== suggestion.changes.length
    || new Set(suggestion.changes.map(change => change.field)).size !== changedFields.length) return null
  const next = { ...draft }
  for (const change of suggestion.changes) {
    const field = change.field
    if (!changedFields.includes(field) || !sameValue(change.original, original[field]) || !sameValue(change.relaxed, relaxed[field])) return null
    if (field === 'query') next.query = relaxed.query
    else if (field === 'max_budget') next.budget = relaxed.max_budget
    else if (field === 'max_distance_km') next.radius = relaxed.max_distance_km == null ? '' : String(relaxed.max_distance_km)
    else return null
  }
  const checked = validateCriteria(next)
  return checked.ok && isShoppingRequest({ request_id: requestId, revision: revision + 1, criteria: checked.criteria, comparison: null }) ? next : null
}
