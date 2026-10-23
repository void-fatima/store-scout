import { describe, expect, it, vi } from 'vitest'
import { createIntentClient } from './intent'
import { createdIntentFixture, readyIntentFixture, confirmedIntentFixture, rejectedIntentFixture, intentJourneyFixture } from '../test/fixtures/intents'

const session = { draftId: readyIntentFixture.draft_id, token: createdIntentFixture.access_token }
const signal = () => new AbortController().signal
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })

it('creates and carries only the per-draft capability in an authorization header', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(createdIntentFixture, 201)).mockResolvedValueOnce(json(readyIntentFixture))
  const client = createIntentClient({ baseUrl: 'https://api.example.test', fetcher })
  expect((await client.create({ message: 'گوشی' }, signal())).ok).toBe(true)
  expect((await client.revise(session, createdIntentFixture.draft, { expected_revision: 0, changes: {
    coordinates: { latitude: 35.7, longitude: 51.4 }, radius: '۵ کیلومتر',
  } }, signal())).ok).toBe(true)
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.example.test/api/v1/journey/intents')
  const [url, init] = fetcher.mock.calls[1]!
  expect(String(url)).not.toContain(session.token)
  expect(init).toMatchObject({ credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    headers: { Authorization: `Bearer ${session.token}` } })
  expect(String(init?.body)).not.toContain(session.token)
})

it('confirms and rejects only the unchanged, owning persisted revision', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(confirmedIntentFixture)).mockResolvedValueOnce(json(rejectedIntentFixture))
  const client = createIntentClient({ fetcher })
  expect((await client.confirm(session, readyIntentFixture, { expected_revision: 1, confirm: true }, signal())).ok).toBe(true)
  expect((await client.reject(session, confirmedIntentFixture, { expected_revision: 1 }, signal())).ok).toBe(true)
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({ expected_revision: 1, confirm: true })
})

it.each(['wrong_id', 'revision', 'criteria', 'confirmed_on_revise', 'extra', 'bad_type'])('rejects incompatible %s responses', async kind => {
  const value = structuredClone(confirmedIntentFixture)
  if (kind === 'wrong_id') value.draft_id = 'b'.repeat(32)
  if (kind === 'revision') value.revision++
  if (kind === 'criteria') value.criteria.q = 'replacement'
  const body: unknown = kind === 'extra' ? { ...value, injected: 'private' } : kind === 'bad_type' ? { ...value, revision: '1' } : value
  const client = createIntentClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(json(body)) })
  const result = kind === 'confirmed_on_revise'
    ? await client.revise(session, createdIntentFixture.draft, { expected_revision: 0, message: 'تأیید شد' }, signal())
    : await client.confirm(session, readyIntentFixture, { expected_revision: 1, confirm: true }, signal())
  expect(result.ok).toBe(false)
})

it('rejects invalid requests, incomplete previews and mismatched capability ownership before HTTP', async () => {
  const fetcher = vi.fn<typeof fetch>()
  const client = createIntentClient({ fetcher })
  expect((await client.confirm(session, createdIntentFixture.draft, { expected_revision: 0, confirm: true }, signal())).ok).toBe(false)
  expect((await client.revise(session, readyIntentFixture, { expected_revision: 0, message: 'text' }, signal())).ok).toBe(false)
  expect((await client.revise(session, readyIntentFixture, { expected_revision: 1, message: 'text', changes: {} }, signal())).ok).toBe(false)
  expect((await client.revise(session, readyIntentFixture, { expected_revision: 1, changes: {} }, signal())).ok).toBe(false)
  expect((await client.create({ message: ' '.repeat(2) }, signal())).ok).toBe(false)
  expect((await client.create({ message: 'x'.repeat(2001) }, signal())).ok).toBe(false)
  expect((await client.get({ ...session, draftId: 'b'.repeat(32) }, readyIntentFixture, signal())).ok).toBe(false)
  expect(fetcher).not.toHaveBeenCalled()
})

it('accepts refreshed newer revisions but rejects older versions', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(rejectedIntentFixture)).mockResolvedValueOnce(json(createdIntentFixture.draft))
  const client = createIntentClient({ fetcher })
  expect((await client.get(session, readyIntentFixture, signal())).ok).toBe(true)
  expect((await client.get(session, readyIntentFixture, signal())).ok).toBe(false)
})

describe('safe failures', () => {
  it.each([404, 409, 413, 422, 429, 502, 503, 504])('keeps %s error codes but hides upstream messages', async status => {
    const client = createIntentClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(json({ error: {
      code: status === 409 ? 'stale_intent' : 'intent_unavailable', message: 'private-provider-secret', details: [{ password: 'private' }],
    } }, status)) })
    const result = await client.get(session, readyIntentFixture, signal())
    expect(result.ok).toBe(false)
    expect(JSON.stringify(result)).not.toContain('private')
  })
  it('handles non-JSON unavailable routes, network failure, abort and configuration', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('html', { status: 404 })).mockRejectedValueOnce(new Error('secret'))
    const client = createIntentClient({ fetcher })
    expect((await client.create({ message: 'گوشی' }, signal())).ok).toBe(false)
    expect((await client.create({ message: 'گوشی' }, signal())).ok).toBe(false)
    const abort = new AbortController(); abort.abort()
    expect((await client.create({ message: 'گوشی' }, abort.signal)).ok).toBe(false)
    expect((await createIntentClient({ baseUrl: 'https://user:password@example.test', fetcher }).create({ message: 'گوشی' }, signal())).ok).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

it('executes through the confirmed route and rejects mismatched Journey identity or criteria', async () => {
  const response = structuredClone(intentJourneyFixture)
  const confirmed = structuredClone(confirmedIntentFixture)
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(response)).mockResolvedValueOnce(json({ ...response, state: { ...response.state, revision: 0 } }))
  const client = createIntentClient({ fetcher })
  expect((await client.recommendations(session, confirmed, signal())).ok).toBe(true)
  expect(String(fetcher.mock.calls[0]![0])).toBe(`/api/v1/journey/intents/${confirmed.draft_id}/recommendations`)
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({ expected_revision: 1 })
  expect((await client.recommendations(session, confirmed, signal())).ok).toBe(false)
  expect((await client.recommendations(session, readyIntentFixture, signal())).ok).toBe(false)
  expect(fetcher).toHaveBeenCalledTimes(2)
})
