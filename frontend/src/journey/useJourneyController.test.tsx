import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AlternativeAcceptance, ShoppingRequest } from '../contracts'
import { createJourneyClient } from '../api/journey'
import { isShoppingRequest } from '../api/validation'
import { acceptedJourneyFixture, errorFixture, journeyFixture } from '../test/fixtures/contracts'
import { associatedFixture, sampleDraft } from '../test/journey-fixtures'
import { responseEntries } from './operations'
import { useJourneyController } from './useJourneyController'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
function requestAt(fetcher: ReturnType<typeof vi.fn<typeof fetch>>, index: number): ShoppingRequest {
  const data: unknown = JSON.parse(String(fetcher.mock.calls[index]?.[1]?.body))
  if (!isShoppingRequest(data)) throw new Error('Expected canonical ShoppingRequest')
  return data
}
function setup(fetcher: ReturnType<typeof vi.fn<typeof fetch>>) {
  return renderHook(() => useJourneyController({
    client: createJourneyClient({ fetcher }), initialDraft: sampleDraft(), requestId: 'controller-request',
  }))
}
function acceptance(revision: number): AlternativeAcceptance {
  const suggestion = journeyFixture.result.suggestions[0]
  const dataset = journeyFixture.result.original.context.dataset
  if (!suggestion || !dataset) throw new Error('Canonical alternative fixture missing')
  return { request_id: 'controller-request', expected_revision: revision, dataset_id: dataset.dataset_id,
    offer_id: suggestion.result.offer_id, accepted_changes: suggestion.changes }
}
const successFetcher = () => vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
  const data: unknown = JSON.parse(String(init?.body))
  if (!isShoppingRequest(data)) throw new Error('Invalid request')
  return json(associatedFixture(data))
})

describe('parent Journey state and panel callbacks', () => {
  it('preserves full results and validates comparison/verification against canonical identities', async () => {
    const fetcher = successFetcher()
    const { result } = setup(fetcher)
    act(() => result.current.submit())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(result.current.panelProps.response).toEqual(journeyFixture.result)
    const entry = responseEntries(journeyFixture.result)[0]
    if (!entry?.plan) throw new Error('Expected verification plan')
    act(() => result.current.panelProps.onComparisonChange([entry.key]))
    expect(result.current.state.comparison).toEqual([entry.key])
    act(() => result.current.panelProps.onComparisonChange([entry.key, entry.key]))
    expect(result.current.state.comparison).toEqual([entry.key])
    act(() => result.current.panelProps.onComparisonChange([{ ...entry.key, dataset_id: 'old-dataset' }]))
    expect(result.current.state.comparison).toEqual([entry.key])
    act(() => result.current.panelProps.onViewVerification(entry.key, { ...entry.plan!, recorded_warranty: 'forged' }))
    expect(result.current.state.selectedVerification?.plan).toEqual(entry.plan)
    expect(result.current.state.selectedVerification?.plan.contact_attempted).toBe(false)
    const oldPanel = result.current.panelProps
    act(() => result.current.changeDraft({ ...result.current.state.draft, radius: '5' }))
    expect(result.current.state).toMatchObject({ revision: 1, response: null, comparison: [], selectedVerification: null })
    act(() => oldPanel.onComparisonChange([entry.key]))
    expect(result.current.state.comparison).toEqual([])
  })

  it('cancels edits and ignores out-of-order responses even if fetch ignores cancellation', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    const fetcher = vi.fn<typeof fetch>().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = setup(fetcher)
    act(() => result.current.submit())
    const stalePanel = result.current.panelProps
    act(() => result.current.changeDraft({ ...result.current.state.draft, budget: '17000000.1234567890' }))
    expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    act(() => stalePanel.onRetry('controller-request', 0))
    expect(fetcher).toHaveBeenCalledTimes(1)
    act(() => result.current.submit())
    await act(async () => second.resolve(json(associatedFixture(requestAt(fetcher, 1)))))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    const currentResponse = result.current.state.response
    await act(async () => first.resolve(json(associatedFixture(requestAt(fetcher, 0)))))
    expect(result.current.state.response).toBe(currentResponse)
    expect(result.current.state.revision).toBe(1)
  })

  it('clears prior dataset selections/plans on a fresh search, snapshot conflict and dataset replacement', async () => {
    const fetcher = successFetcher()
    const { result } = setup(fetcher)
    act(() => result.current.submit())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    const entry = responseEntries(journeyFixture.result)[0]
    if (!entry?.plan) throw new Error('Expected plan')
    act(() => { result.current.panelProps.onComparisonChange([entry.key]); result.current.panelProps.onViewVerification(entry.key, entry.plan!) })
    fetcher.mockResolvedValueOnce(json(errorFixture, 409))
    act(() => result.current.panelProps.onRetry('controller-request', 0))
    expect(result.current.state).toMatchObject({ status: 'loading', response: null, comparison: [], selectedVerification: null })
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.error?.error.code).toBe('catalog_snapshot_changed')
    expect(result.current.state.response).toBeNull()
    const replacement = associatedFixture(requestAt(fetcher, 0))
    if (!replacement.result.original.context.dataset) throw new Error('Expected dataset')
    replacement.result.original.context.dataset.dataset_id = 'new-dataset'
    fetcher.mockResolvedValueOnce(json(replacement))
    act(() => result.current.panelProps.onRetry('controller-request', 0))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    act(() => result.current.panelProps.onComparisonChange([entry.key]))
    expect(result.current.state.comparison).toEqual([])
    expect(result.current.state.response?.original.context.dataset?.dataset_id).toBe('new-dataset')
  })

  it('accepts only the actual complete changes at the current identity/revision/dataset and sends a fresh request', async () => {
    const fresh = deferred<Response>()
    const fetcher = successFetcher().mockReturnValueOnce(Promise.resolve(json(associatedFixture({ request_id: 'controller-request', revision: 0 }))))
      .mockReturnValueOnce(fresh.promise)
    const { result } = setup(fetcher)
    act(() => result.current.submit())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    const accepted = acceptance(0)
    act(() => { Reflect.apply(result.current.panelProps.onAcceptAlternative, undefined, [{ ...accepted, accepted_changes: [] }]) })
    const change = accepted.accepted_changes[0]
    for (const invalid of [
      { ...accepted, request_id: 'other' }, { ...accepted, expected_revision: 2 },
      { ...accepted, dataset_id: 'other' }, { ...accepted, offer_id: 'invented' },
      { ...accepted, accepted_changes: [{ ...change, relaxed: '999999999' }] },
      { ...accepted, accepted_changes: [change, change] },
    ] satisfies AlternativeAcceptance[]) {
      act(() => result.current.panelProps.onAcceptAlternative(invalid))
    }
    expect(fetcher).toHaveBeenCalledTimes(1)
    const stalePanel = result.current.panelProps
    act(() => result.current.panelProps.onAcceptAlternative(accepted))
    expect(result.current.state).toMatchObject({ revision: 1, status: 'loading', comparison: [], response: null })
    const request = requestAt(fetcher, 1)
    expect(request).toMatchObject({ request_id: 'controller-request', revision: 1, comparison: null,
      criteria: { max_budget: acceptedJourneyFixture.result.original_constraints.max_budget, price_unit: 'TOMAN', q: 'گوشی', latitude: 35.7, longitude: 51.4 } })
    expect(fetcher.mock.calls[1]?.[0]).toBe('/api/v1/journey/recommendations')
    act(() => stalePanel.onAcceptAlternative(accepted))
    expect(fetcher).toHaveBeenCalledTimes(2)
    await act(async () => fresh.resolve(json(associatedFixture(request, acceptedJourneyFixture))))
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    expect(result.current.state.response).toEqual(acceptedJourneyFixture.result)
    expect(result.current.state.response?.original.recommendations.length).toBeGreaterThan(0)
  })

  it('keeps input and maps canonical field errors safely while requiring an explicit retry', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ error: {
      code: 'invalid_request', message: 'private traceback', details: [{ location: ['body', 'criteria', 'max_budget'], message: 'secret' }],
    } }, 422))
    const { result, unmount } = setup(fetcher)
    act(() => result.current.submit())
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state.draft.budget).toBe(sampleDraft().budget)
    expect(result.current.state.fieldErrors.budget).toBeTruthy()
    expect(JSON.stringify(result.current.panelProps.error)).not.toContain('traceback')
    expect(fetcher).toHaveBeenCalledTimes(1)
    act(() => result.current.panelProps.onRetry('wrong-request', 0))
    expect(fetcher).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('aborts on unmount and does not submit invalid criteria', () => {
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(new Promise(() => {}))
    const { result, unmount } = setup(fetcher)
    act(() => result.current.changeDraft({ ...sampleDraft(), latitude: '' }))
    act(() => result.current.submit())
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.state.fieldErrors.latitude).toBeTruthy()
    act(() => result.current.changeDraft(sampleDraft()))
    act(() => result.current.submit())
    const signal = fetcher.mock.calls[0]?.[1]?.signal
    unmount()
    expect(signal?.aborted).toBe(true)
  })
})
