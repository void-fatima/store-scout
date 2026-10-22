import { expect, expectTypeOf, it } from 'vitest'
import type {
  AlternativeAcceptance, AlternativesResponse, ComparisonKey, FollowupPlan,
  JourneySearchCriteria, JsonValue, OfferCandidate, ShoppingCriteria, ShoppingRequest,
} from './index'
import {
  acceptanceFixture, alternativesFixture, journeyFixture,
  recommendationFixture, requestFixture,
} from '../test/fixtures/contracts'

it('retains exact money, nullability, input optionality and canonical verification literals', () => {
  expectTypeOf<ShoppingCriteria['max_budget']>().toEqualTypeOf<string>()
  expectTypeOf<JourneySearchCriteria['max_budget']>().toEqualTypeOf<string | number | null | undefined>()
  expectTypeOf<OfferCandidate['price_toman']>().toEqualTypeOf<number | null>()
  expectTypeOf<FollowupPlan['last_price_changed_at']>().toEqualTypeOf<string | null>()
  expectTypeOf<NonNullable<FollowupPlan['availability']>>().toEqualTypeOf<'unconfirmed'>()
  expectTypeOf<NonNullable<FollowupPlan['contact_attempted']>>().toEqualTypeOf<false>()
  expectTypeOf<NonNullable<FollowupPlan['state']>>().toEqualTypeOf<'awaiting_user_verification'>()
  expectTypeOf<JsonValue>().toBeUnknown()
  expectTypeOf<Extract<keyof ShoppingRequest, 'status' | 'search_performed'>>().toEqualTypeOf<never>()
  expect(requestFixture.criteria?.max_budget).toBe('17000000.123456789')
})

it('uses model-validated fixtures for full responses, verification and explicit acceptance', () => {
  expectTypeOf(alternativesFixture).toEqualTypeOf<AlternativesResponse>()
  expectTypeOf(acceptanceFixture).toMatchTypeOf<AlternativeAcceptance>()
  expect(alternativesFixture.original.recommendations).toEqual([])
  expect(alternativesFixture.suggestions.length).toBeGreaterThan(0)
  expect(recommendationFixture.recommendations.length).toBeGreaterThan(0)
  expect(journeyFixture.state.status).toBe('recommendations_ready')
  expect(journeyFixture.result.original_constraints.max_budget).toBe('17000000.123456789')
  const suggestion = alternativesFixture.suggestions[0]
  expect(acceptanceFixture.accepted_changes).toEqual(suggestion?.changes)
  expect(suggestion?.verification.checklist.every(item => item.state === 'pending')).toBe(true)
  expect(suggestion?.requires_user_acceptance).toBe(true)
  expect(suggestion?.satisfies_original_constraints).toBe(false)
})

it('retains distinct comparison identities for canonical offers with the same title', () => {
  const dataset = alternativesFixture.original.context.dataset
  if (!dataset) throw new Error('Canonical fixture must retain dataset provenance')
  const selections: ComparisonKey[] = alternativesFixture.suggestions.map(({ result }) => ({
    dataset_id: dataset.dataset_id, product_id: result.product_id, offer_id: result.offer_id,
  }))
  const titles = alternativesFixture.suggestions.map(item => item.result.candidate.product.persian_title)
  expect(new Set(titles).size).toBe(1)
  expect(new Set(selections.map(key => key.product_id)).size).toBeGreaterThan(1)
  expect(new Set(selections.map(key => key.offer_id)).size).toBe(selections.length)
})
