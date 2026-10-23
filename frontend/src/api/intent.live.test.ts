import { expect, it } from 'vitest'
import { createIntentClient } from './intent'

const baseUrl = process.env.STORE_SCOUT_INTENT_API

it.skipIf(!baseUrl)('uses actual pinned intent HTTP with fixture interpretation and sample Catalog', async () => {
  expect(['localhost', '127.0.0.1']).toContain(new URL(baseUrl!).hostname)
  const health = await fetch(`${baseUrl}/health`)
  expect(health.headers.get('x-storescout-interpretation')).toBe('fixture-only-18756bf')
  const client = createIntentClient({ baseUrl: baseUrl! })
  const signal = new AbortController().signal
  const created = await client.create({ message: 'گوشی سامسونگ تا ۳۰ میلیون تومان' }, signal)
  if (!created.ok) throw new Error('Disposable fixture intent API unavailable')
  expect(created.value.draft.status).toBe('needs_clarification')
  const session = { draftId: created.value.draft.draft_id, token: created.value.access_token }
  expect((await client.recommendations(session, created.value.draft, signal)).ok).toBe(false)
  const revised = await client.revise(session, created.value.draft, { expected_revision: 0, changes: {
    coordinates: { latitude: 35.7, longitude: 51.4 }, radius: '۵ کیلومتر',
  } }, signal)
  if (!revised.ok) throw new Error('Fixture revision failed')
  expect(revised.value.status).toBe('awaiting_confirmation')
  expect(revised.value.search_performed).toBe(false)
  const confirmed = await client.confirm(session, revised.value, { expected_revision: 1, confirm: true }, signal)
  if (!confirmed.ok) throw new Error('Fixture confirmation failed')
  const result = await client.recommendations(session, confirmed.value, signal)
  if (!result.ok) throw new Error('Fixture Catalog execution failed')
  expect(result.value.state.request_id).toBe(session.draftId)
  expect(result.value.state.revision).toBe(1)
  expect(result.value.result.original.context.dataset?.source_kind).toBe('sample')
  expect(result.value.result.original.recommendations.length).toBeGreaterThan(0)
  expect(result.value.result.original.recommendations.every(item => item.before_visit_verification?.status === 'unverified')).toBe(true)
  const rejected = await client.reject(session, confirmed.value, { expected_revision: 1 }, signal)
  if (!rejected.ok) throw new Error('Fixture rejection failed')
  expect(rejected.value.status).toBe('rejected')
  expect(rejected.value.revision).toBe(2)
  expect((await client.recommendations(session, confirmed.value, signal)).ok).toBe(false)
  const preflight = await fetch(`${baseUrl}/api/v1/journey/intents/${session.draftId}/confirm`, { method: 'OPTIONS', headers: {
    Origin: 'http://localhost:5189', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type',
  } })
  expect(preflight.status).toBe(200)
  expect(preflight.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization')
}, 15000)
