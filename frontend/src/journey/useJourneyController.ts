import { useEffect, useRef, useState } from 'react'
import type { AlternativesResponse, ComparisonKey, FollowupPlan, JourneySearchCriteria, RecommendationPanelProps, ShoppingRequest } from '../contracts'
import { createJourneyClient, localError, userError } from '../api/journey'
import type { JourneyClient, JourneyFailure, JourneyResult } from '../api/journey'
import { draftFromCriteria, emptyDraft, fieldErrorsFromApi, validateCriteria } from './criteria'
import { isShoppingRequest } from '../api/validation'
import type { CriteriaDraft, FieldErrors } from './criteria'
import { acceptedDraft, responseEntries, sameValue, validComparison } from './operations'

type Selection = { key: ComparisonKey; plan: FollowupPlan }
export type JourneyControllerState = {
  requestId: string; revision: number; draft: CriteriaDraft; criteria: JourneySearchCriteria | null
  status: RecommendationPanelProps['status']; response: AlternativesResponse | null
  comparison: readonly ComparisonKey[]; selectedVerification: Selection | null
  error: RecommendationPanelProps['error']; failure: JourneyFailure | null; fieldErrors: FieldErrors; notice: string | null
}
const defaultClient = createJourneyClient()

export function useJourneyController(options: { client?: JourneyClient; requestId?: string; initialDraft?: CriteriaDraft } = {}) {
  const client = options.client ?? defaultClient
  const [state, setState] = useState<JourneyControllerState>(() => {
    const draft = options.initialDraft ?? emptyDraft()
    const checked = validateCriteria(draft)
    return { requestId: options.requestId ?? crypto.randomUUID(), revision: 0, draft,
      criteria: checked.ok ? checked.criteria : null, status: 'idle', response: null, comparison: [],
      selectedVerification: null, error: null, failure: null, fieldErrors: {}, notice: null }
  })
  // Update synchronously as well as through React: rapid events must see the new revision.
  const current = useRef(state)
  const active = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const mounted = useRef(true)
  const replay = useRef<{ criteria: JourneySearchCriteria; client: JourneyClient } | null>(null)
  function update(next: JourneyControllerState) { current.current = next; setState(next) }
  function invalidate() { generation.current += 1; active.current?.abort(); active.current = null }
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; generation.current += 1; active.current?.abort() }
  }, [])

  function changeDraft(draft: CriteriaDraft) {
    if (sameValue(draft, current.current.draft)) return
    invalidate()
    replay.current = null
    const checked = validateCriteria(draft)
    update({ ...current.current, draft, revision: current.current.revision + 1,
      criteria: checked.ok ? checked.criteria : null, status: 'idle', response: null,
      comparison: [], selectedVerification: null, error: null, failure: null, fieldErrors: {}, notice: null })
  }

  async function send(base: JourneyControllerState, criteria: JourneySearchCriteria, requestClient = client) {
    invalidate()
    replay.current = { criteria, client: requestClient }
    const epoch = generation.current
    const controller = new AbortController()
    active.current = controller
    update({ ...base, criteria, status: 'loading', response: null, comparison: [], selectedVerification: null,
      error: null, failure: null, fieldErrors: {}, notice: null })
    const request = { request_id: base.requestId, revision: base.revision, criteria, comparison: null }
    let result: JourneyResult
    try { result = await requestClient(request, controller.signal) }
    catch { result = { ok: false, failure: { kind: 'network', error: localError('network_unavailable', 'ارتباط با سرویس برقرار نشد.') } } }
    if (!mounted.current || epoch !== generation.current || controller.signal.aborted
      || current.current.requestId !== base.requestId || current.current.revision !== base.revision) return
    active.current = null
    if (result.ok && (result.value.state.request_id !== base.requestId || (result.value.state.revision ?? 0) !== base.revision)) {
      result = { ok: false, failure: { kind: 'invalid_response', error: localError('invalid_journey_response', 'پاسخ معتبر دریافت نشد.') } }
    }
    if (!result.ok) {
      const failure = result.failure
      update({ ...current.current, status: failure.kind === 'cancelled' ? 'idle' : 'error',
        response: null, comparison: [], selectedVerification: null,
        error: failure.kind === 'cancelled' ? null : userError(failure.error), failure,
        fieldErrors: fieldErrorsFromApi(failure.error) })
    } else {
      // Keep the exact complete response and its ranking/provenance/coverage order.
      update({ ...current.current, status: 'ready', response: result.value.result, error: null, failure: null })
    }
  }

  function submit() {
    const base = current.current
    if (base.status === 'loading') return
    const checked = validateCriteria(base.draft)
    if (!checked.ok) { update({ ...base, fieldErrors: checked.errors }); return }
    void send(base, checked.criteria)
  }
  function boundaryCurrent() {
    return current.current.status === 'ready' && state.response !== null
      && current.current.response === state.response && current.current.revision === state.revision
  }
  function rejectInteraction() {
    update({ ...current.current, notice: 'این انتخاب با نتیجهٔ فعلی هماهنگ نیست. نتیجهٔ تازه را بررسی کنید.' })
  }
  const panelProps: RecommendationPanelProps = {
    requestId: state.requestId, revision: state.revision, response: state.response,
    comparison: state.comparison, status: state.status, error: state.error,
    onComparisonChange(keys) {
      if (!boundaryCurrent() || !current.current.response) return
      const selected = validComparison(current.current.response, keys)
      if (!selected) { rejectInteraction(); return }
      update({ ...current.current, comparison: selected, notice: null })
    },
    onViewVerification(key, _suppliedPlan) {
      if (!boundaryCurrent() || !current.current.response) return
      const entry = responseEntries(current.current.response).find(entry => sameValue(entry.key, key))
      if (!entry?.plan) { rejectInteraction(); return }
      // Select owning evidence; never accept a caller's replacement checklist.
      update({ ...current.current, selectedVerification: { key: entry.key, plan: entry.plan }, notice: null })
    },
    onRetry(requestId, revision) {
      if (requestId !== current.current.requestId || revision !== current.current.revision
        || revision !== state.revision || current.current.status === 'loading') return
      const retry = replay.current
      if (retry) void send(current.current, retry.criteria, retry.client)
      else submit()
    },
    onAcceptAlternative(acceptance) {
      const base = current.current
      if (!boundaryCurrent() || !base.response) return
      const nextDraft = acceptedDraft({ response: base.response, acceptance, requestId: base.requestId, revision: base.revision, draft: base.draft })
      if (!nextDraft) { rejectInteraction(); return }
      const checked = validateCriteria(nextDraft)
      if (!checked.ok) { rejectInteraction(); return }
      void send({ ...base, draft: nextDraft, revision: base.revision + 1 }, checked.criteria)
    },
  }
  function discardResults() {
    invalidate()
    replay.current = null
    update({ ...current.current, status: 'idle', response: null, comparison: [], selectedVerification: null,
      error: null, failure: null, fieldErrors: {}, notice: null })
  }
  async function submitConfirmedIntent(request: ShoppingRequest, execute: JourneyClient) {
    if (!isShoppingRequest(request) || !request.criteria) return
    await send({ ...current.current, requestId: request.request_id, revision: request.revision ?? 0,
      draft: draftFromCriteria(request.criteria) }, request.criteria, execute)
  }
  return { state, panelProps, changeDraft, submit, discardResults, submitConfirmedIntent, requestEpoch: () => generation.current,
    clearVerification: () => update({ ...current.current, selectedVerification: null }) }
}
