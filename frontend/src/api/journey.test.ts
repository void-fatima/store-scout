import { describe, expect, it, vi } from 'vitest'
import { journeyFixture, requestFixture, errorFixture } from '../test/fixtures/contracts'
import { createJourneyClient } from './journey'

const signal = () => new AbortController().signal
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

describe('Journey HTTP boundary', () => {
  it('posts exact monetary strings without credentials and preserves the complete envelope', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(journeyFixture))
    const result = await createJourneyClient({ baseUrl: 'http://localhost:8000/', fetcher })(requestFixture, signal())
    expect(result).toEqual({ ok: true, value: journeyFixture })
    expect(fetcher).toHaveBeenCalledWith('http://localhost:8000/api/v1/journey/recommendations', expect.objectContaining({
      method: 'POST', credentials: 'omit', body: JSON.stringify(requestFixture),
    }))
    expect(fetcher.mock.calls[0]?.[1]?.body).toContain('"max_budget":"17000000.123456789"')
  })

  it('retains canonical structured errors', async () => {
    const client = createJourneyClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(json(errorFixture, 409)) })
    expect(await client(requestFixture, signal())).toEqual({
      ok: false, failure: { kind: 'api', status: 409, error: errorFixture },
    })
  })

  it.each([404, 405, 501])('reports unavailable route %s without mock fallback', async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('not found', { status }))
    const result = await createJourneyClient({ fetcher })(requestFixture, signal())
    expect(result).toMatchObject({ ok: false, failure: { kind: 'route_unavailable' } })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each([
    {}, { ...journeyFixture, result: { ...journeyFixture.result, original_verification: 'broken' } },
    { ...journeyFixture, state: { ...journeyFixture.state, revision: 99 } },
    { ...journeyFixture, state: { ...journeyFixture.state, request_id: 'other' } },
  ])('rejects unexpected or unrelated responses', async data => {
    const result = await createJourneyClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(json(data)) })(requestFixture, signal())
    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid_response' } })
  })

  it('hides malformed JSON, unstructured errors and raw network exceptions', async () => {
    for (const response of [new Response('<html>trace</html>'), new Response('secret trace', { status: 500 })]) {
      expect(await createJourneyClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(response) })(requestFixture, signal()))
        .toMatchObject({ ok: false, failure: { kind: 'invalid_response' } })
    }
    const result = await createJourneyClient({ fetcher: vi.fn<typeof fetch>().mockRejectedValue(new Error('secret trace')) })(requestFixture, signal())
    expect(result).toMatchObject({ ok: false, failure: { kind: 'network' } })
    expect(JSON.stringify(result)).not.toContain('secret trace')
  })

  it('handles cancellation before and during fetch', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort()
      throw new DOMException('Aborted', 'AbortError')
    })
    const client = createJourneyClient({ fetcher })
    expect(await client(requestFixture, controller.signal)).toMatchObject({ ok: false, failure: { kind: 'cancelled' } })
    expect(await client(requestFixture, controller.signal)).toMatchObject({ ok: false, failure: { kind: 'cancelled' } })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects credentials and invalid API configuration before transmission', async () => {
    const fetcher = vi.fn<typeof fetch>()
    expect(await createJourneyClient({ baseUrl: 'http://user:password@localhost', fetcher })(requestFixture, signal()))
      .toMatchObject({ ok: false, failure: { kind: 'configuration' } })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
