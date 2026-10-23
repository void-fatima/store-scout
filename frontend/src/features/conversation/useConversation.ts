import { useEffect, useRef, useState } from 'react'
import type { IntentPatch, IntentView } from '../../contracts/intent'
import { createIntentClient, executableIntent, intentError } from '../../api/intent'
import type { IntentClient, IntentResult, IntentSession } from '../../api/intent'
import { localError } from '../../api/journey'
import type { JourneyFailure } from '../../api/journey'
import type { useJourneyController } from '../../journey/useJourneyController'

type Controller = ReturnType<typeof useJourneyController>
type ConversationState = { draft: IntentView | null; busy: string | null; error: string | null;
  blocked: boolean; expired: boolean; dirty: boolean; consent: boolean; completed: boolean; editKey: number }
const empty = (): ConversationState => ({ draft: null, busy: null, error: null, blocked: false,
  expired: false, dirty: false, consent: false, completed: false, editKey: 0 })
const defaultClient = createIntentClient()

/** Capability exists only in this ref. Backend owns drafts; Journey owns results. */
export function useConversation(controller: Controller, client: IntentClient = defaultClient) {
  const [state, setState] = useState<ConversationState>(empty)
  const current = useRef(state)
  const session = useRef<IntentSession | null>(null)
  const active = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const mounted = useRef(true)
  const journey = useRef(controller)
  useEffect(() => { journey.current = controller }, [controller])
  function update(next: ConversationState) { current.current = next; setState(next) }
  function cancel() { generation.current++; active.current?.abort(); active.current = null }
  useEffect(() => {
    mounted.current = true
    return () => {
      // These refs track the latest operation lifetime, not captured DOM nodes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      mounted.current = false; generation.current++
      // This is the latest network operation, not a DOM ref captured at mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      active.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (!state.draft || state.expired) return
    const expires = state.draft.expires_at
    const timer = setInterval(() => {
      if (Date.now() / 1000 < expires) return
      generation.current++; active.current?.abort(); active.current = null; session.current = null
      if (current.current.busy) journey.current.discardResults()
      const next = { ...current.current, busy: null, expired: true, consent: false, blocked: true }
      current.current = next; setState(next)
    }, 1000)
    return () => clearInterval(timer)
  }, [state.draft, state.expired])

  function fail(failure: JourneyFailure, during: string) {
    const blocked = failure.status === 404 || failure.status === 409 || failure.kind === 'network' || failure.kind === 'invalid_response'
    update({ ...current.current, busy: null, consent: false, error: intentError(failure.error.error.code),
      blocked: current.current.draft !== null && (blocked || current.current.blocked), completed: false,
      dirty: during === 'اصلاح پیش‌نویس' ? current.current.dirty : false })
  }
  async function run(label: string, operation: (abort: AbortSignal) => Promise<IntentResult<IntentView>>) {
    if (current.current.busy || current.current.expired) return
    cancel()
    const epoch = generation.current
    const abort = new AbortController(); active.current = abort
    journey.current.discardResults()
    update({ ...current.current, busy: label, consent: false, error: null, completed: false })
    let result: IntentResult<IntentView>
    try { result = await operation(abort.signal) }
    catch { result = { ok: false, failure: { kind: 'network', error: localError('network_unavailable', '') } } }
    if (!mounted.current || generation.current !== epoch || abort.signal.aborted) return
    active.current = null
    if (!result.ok) { fail(result.failure, label); return }
    const expired = result.value.expires_at <= Date.now() / 1000
    update({ ...current.current, draft: result.value, busy: null, error: null, blocked: expired,
      expired, dirty: false, consent: false, editKey: current.current.editKey + 1 })
  }
  function available() {
    return !current.current.busy && !current.current.expired && !current.current.blocked
      && !!session.current && !!current.current.draft && current.current.draft.expires_at > Date.now() / 1000
  }
  function reset() {
    cancel(); session.current = null; journey.current.discardResults()
    update({ ...empty(), editKey: current.current.editKey + 1 })
  }
  function touch() {
    if (current.current.busy) return
    journey.current.discardResults()
    update({ ...current.current, consent: false, dirty: true, completed: false })
  }
  async function create(message: string) {
    if (current.current.draft || current.current.busy) return
    await run('تفسیر پیام', async signal => {
      const result = await client.create({ message }, signal)
      if (!result.ok) return result
      // Late creation after reset must never restore its capability.
      if (!signal.aborted && mounted.current) session.current = { draftId: result.value.draft.draft_id, token: result.value.access_token }
      return { ok: true, value: result.value.draft }
    })
  }
  async function revise(change: { message: string } | { changes: IntentPatch }) {
    if (!available()) return
    const owner = session.current!, draft = current.current.draft!
    await run('اصلاح پیش‌نویس', signal => client.revise(owner, draft, { expected_revision: draft.revision, ...change }, signal))
  }
  async function refresh() {
    if (!session.current || !current.current.draft) return
    const owner = session.current, draft = current.current.draft
    await run('بازیابی نسخهٔ فعلی', signal => client.get(owner, draft, signal))
  }
  async function reject() {
    if (!available()) return
    const owner = session.current!, draft = current.current.draft!
    await run('رد پیش‌نویس', signal => client.reject(owner, draft, { expected_revision: draft.revision }, signal))
  }
  async function confirm() {
    const draft = current.current.draft, owner = session.current
    if (!available() || !draft || !owner || !current.current.consent || current.current.dirty || !executableIntent(draft)) return
    cancel()
    const epoch = generation.current, abort = new AbortController(); active.current = abort
    journey.current.discardResults()
    const journeyEpoch = journey.current.requestEpoch()
    update({ ...current.current, busy: 'ثبت تأیید همین نسخه', consent: false, error: null })
    let result: IntentResult<IntentView>
    try { result = await client.confirm(owner, draft, { expected_revision: draft.revision, confirm: true }, abort.signal) }
    catch { result = { ok: false, failure: { kind: 'network', error: localError('network_unavailable', '') } } }
    if (!mounted.current || generation.current !== epoch || abort.signal.aborted) return
    if (!result.ok) { active.current = null; fail(result.failure, 'تأیید'); return }
    if (journey.current.requestEpoch() !== journeyEpoch) {
      active.current = null
      update({ ...current.current, busy: null, consent: false, error: 'معیارهای فرم یا جست‌وجوی فعال تغییر کرده‌اند؛ برای ادامه دوباره پیش‌نویس را بازبینی کن.' })
      return
    }
    const confirmed = result.value
    update({ ...current.current, draft: confirmed, busy: 'دریافت پیشنهادهای کاتالوگ', dirty: false })
    let succeeded = false
    await journey.current.submitConfirmedIntent({ request_id: confirmed.draft_id, revision: confirmed.revision, criteria: confirmed.criteria }, async (_request, signal) => {
      if (session.current !== owner || current.current.draft !== confirmed || current.current.blocked
        || confirmed.expires_at <= Date.now() / 1000) return { ok: false, failure: { kind: 'api', status: 409, error: localError('confirmation_required', '') } }
      const execution = await client.recommendations(owner, confirmed, signal)
      if (!signal.aborted && mounted.current && current.current.draft === confirmed && session.current === owner) {
        succeeded = execution.ok
        if (!execution.ok) fail(execution.failure, 'جست‌وجو')
      }
      return execution
    })
    if (!mounted.current || generation.current !== epoch || abort.signal.aborted) return
    active.current = null
    update({ ...current.current, busy: null, completed: succeeded, consent: false })
    if (succeeded) window.location.hash = 'results'
  }
  return { state, create, revise, refresh, reject, confirm, reset, touch,
    setConsent(value: boolean) { if (available() && !current.current.dirty) update({ ...current.current, consent: value }) },
    discardLocal() { update({ ...current.current, dirty: false, consent: false, editKey: current.current.editKey + 1 }) },
  }
}
