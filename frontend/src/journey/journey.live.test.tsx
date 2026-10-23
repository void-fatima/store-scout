/// <reference types="node" />
import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { apiEndpoint, createJourneyClient } from '../api/journey'
import { emptyDraft } from './criteria'
import { responseEntries } from './operations'
import { useJourneyController } from './useJourneyController'

const baseUrl = process.env.STORE_SCOUT_LIVE_API

it.skipIf(!baseUrl)('uses the real temporary sample API for parent submission, acceptance, errors and POST preflight', async () => {
  const client = createJourneyClient({ baseUrl: baseUrl ?? '' })
  const { result, unmount } = renderHook(() => useJourneyController({
    client, requestId: 'frontend-live-synthetic', initialDraft: {
      ...emptyDraft(), query: 'گوشی سامسونگ', budget: '۱۸۰۰۰۰۰۰۰', priceUnit: 'IRR',
      latitude: '۳۵٫۷', longitude: '۵۱٫۴', radius: '۵',
    },
  }))
  try {
    act(() => result.current.submit())
    await waitFor(() => expect(result.current.state.status).toBe('ready'), { timeout: 10000 })
    const response = result.current.state.response
    const suggestion = response?.suggestions[0]
    const entry = response && responseEntries(response)[0]
    expect(response?.original.context.dataset?.source_kind).toBe('sample')
    expect(response?.original.recommendations).toEqual([])
    if (!suggestion || !entry?.plan) throw new Error('Sample API must return an alternative and verification')
    act(() => {
      result.current.panelProps.onComparisonChange([entry.key])
      result.current.panelProps.onViewVerification(entry.key, entry.plan!)
    })
    expect(result.current.state.comparison).toEqual([entry.key])
    expect(result.current.state.selectedVerification?.plan.contact_attempted).toBe(false)
    // Scripted test acceptance of all disclosed changes; no real user consent is asserted.
    act(() => result.current.panelProps.onAcceptAlternative({
      request_id: 'frontend-live-synthetic', expected_revision: 0, dataset_id: entry.key.dataset_id,
      offer_id: suggestion.result.offer_id, accepted_changes: suggestion.changes,
    }))
    expect(result.current.state).toMatchObject({ revision: 1, response: null, comparison: [] })
    await waitFor(() => expect(result.current.state.status).toBe('ready'), { timeout: 10000 })
    expect(result.current.state.response?.original_constraints).toEqual(suggestion.relaxed_constraints)
    expect(result.current.state.response?.original.recommendations.length).toBeGreaterThan(0)
    const invalid = await client({ request_id: 'frontend-live-invalid', revision: 0,
      criteria: { q: null, latitude: 35.7, longitude: 51.4, max_budget: '20000000', price_unit: 'TOMAN' } }, new AbortController().signal)
    expect(invalid).toMatchObject({ ok: false, failure: { kind: 'api', status: 422, error: { error: { code: 'missing_information' } } } })
    const preflight = await fetch(apiEndpoint(baseUrl ?? ''), { method: 'OPTIONS', headers: {
      Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type',
    } })
    expect(preflight.status).toBe(200)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST')
  } finally { unmount() }
}, 30000)
