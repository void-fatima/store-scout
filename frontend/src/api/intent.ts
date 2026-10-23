import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import requests from '../contracts/intent/requests.schema.json'
import responses from '../contracts/intent/responses.schema.json'
import type { CreatedIntent, IntentView, CreateIntent, ReviseIntent, ConfirmIntent, VersionRequest } from '../contracts/intent'
import type { JourneyRecommendations, ShoppingRequest } from '../contracts'
import { isApiError, isJourneyResponse, isShoppingRequest } from './validation'
import { responseMatchesRequest } from './association'
import { apiEndpoint, localError } from './journey'
import type { JourneyFailure, JourneyResult } from './journey'
import { sameValue } from '../journey/operations'

const ajv = new Ajv({ strict: false, coerceTypes: false, useDefaults: false })
addFormats(ajv)
const isView = ajv.compile<IntentView>({ $defs: responses.$defs, $ref: '#/$defs/IntentView' })
const isCreated = ajv.compile<CreatedIntent>({ $defs: responses.$defs, $ref: '#/$defs/CreatedIntent' })
const requestValidators = Object.fromEntries(['CreateIntent', 'ReviseIntent', 'ConfirmIntent', 'VersionRequest'].map(name =>
  [name, ajv.compile({ $defs: requests.$defs, $ref: `#/$defs/${name}` })]))

export type IntentSession = Readonly<{ draftId: string; token: string }>
export type IntentResult<T> = { ok: true; value: T } | { ok: false; failure: JourneyFailure }
export interface IntentClient {
  create(payload: CreateIntent, signal: AbortSignal): Promise<IntentResult<CreatedIntent>>
  get(session: IntentSession, previous: IntentView, signal: AbortSignal): Promise<IntentResult<IntentView>>
  revise(session: IntentSession, previous: IntentView, payload: ReviseIntent, signal: AbortSignal): Promise<IntentResult<IntentView>>
  confirm(session: IntentSession, previous: IntentView, payload: ConfirmIntent, signal: AbortSignal): Promise<IntentResult<IntentView>>
  reject(session: IntentSession, previous: IntentView, payload: VersionRequest, signal: AbortSignal): Promise<IntentResult<IntentView>>
  recommendations(session: IntentSession, confirmed: IntentView, signal: AbortSignal): Promise<JourneyResult>
}

function failure(kind: JourneyFailure['kind'], code: string, status?: number): { ok: false; failure: JourneyFailure } {
  return { ok: false, failure: { kind, error: localError(code, intentError(code)), ...(status === undefined ? {} : { status }) } }
}

/** Never render upstream error text, exception strings, headers or capability values. */
export function intentError(code: string): string {
  const messages: Readonly<Record<string, string>> = {
    stale_intent: 'این نسخه تغییر کرده است. نسخهٔ فعلی را بازیابی و دوباره بررسی کن.',
    confirmation_required: 'پیش‌نویس کامل و تأیید فعلی لازم است. نسخهٔ فعلی را دوباره بررسی کن.',
    intent_not_found: 'پیش‌نویس در دسترس نیست یا منقضی شده است؛ گفت‌وگوی تازه‌ای آغاز کن.',
    intent_route_unavailable: 'سرویس گفت‌وگوی خرید در این نشانی در دسترس نیست؛ می‌توانی از فرم جست‌وجو استفاده کنی.',
    intent_rate_limit: 'سقف درخواست‌های تفسیر رسیده است؛ بعداً دوباره تلاش کن.',
    llm_rate_limit: 'سرویس تفسیر محدود شده است؛ بعداً دوباره تلاش کن.',
    invalid_intent_request: 'اطلاعات ارسال‌شده معتبر نیست؛ متن یا مقدارها را بررسی کن.',
    invalid_criteria: 'این مقدارها پذیرفته نشدند؛ پیش‌نویس قبلی را بررسی کن.',
    invalid_interpretation: 'تفسیر معتبری دریافت نشد؛ هیچ جست‌وجویی انجام نشد.',
    network_unavailable: 'ارتباط با سرویس برقرار نشد. وضعیت نسخه را پیش از ادامه بازیابی کن.',
    invalid_intent_response: 'پاسخ معتبر و هماهنگ با نسخهٔ فعلی دریافت نشد.',
    catalog_snapshot_changed: 'داده‌های فروشگاه‌ها تغییر کرده‌اند؛ نتیجهٔ قبلی معتبر نیست.',
    catalog_unavailable: 'اطلاعات فروشگاه‌ها موقتاً در دسترس نیست.',
    request_too_large: 'حجم درخواست بیشتر از حد مجاز است؛ متن را کوتاه‌تر کن.',
    invalid_api_configuration: 'نشانی سرویس درست تنظیم نشده است.',
  }
  if (Object.hasOwn(messages, code)) return messages[code]!
  return 'درخواست انجام نشد؛ سرویس تفسیر ممکن است در دسترس نباشد. تلاشی خودکار انجام نمی‌شود.'
}

export function executableIntent(view: IntentView): boolean {
  const c = view.criteria
  return ['awaiting_confirmation', 'confirmed'].includes(view.status) && view.issues.length === 0
    && !!c.q?.trim() && c.max_budget != null && c.price_unit != null
    && c.latitude != null && c.longitude != null && c.max_distance_km != null && c.max_distance_km > 0
    && isShoppingRequest({ request_id: view.draft_id, revision: view.revision, criteria: c })
}

function validView(value: unknown): value is IntentView {
  return isView(value) && /^[a-f0-9]{32}$/.test(value.draft_id)
    && Number.isSafeInteger(value.revision) && value.revision >= 0
    && Number.isSafeInteger(value.expires_at) && value.search_performed === false
    && (!['awaiting_confirmation', 'confirmed'].includes(value.status) || executableIntent(value))
}

export function createIntentClient(options: { baseUrl?: string; fetcher?: typeof fetch } = {}): IntentClient {
  async function send(path: string, signal: AbortSignal, session?: IntentSession, payload?: object): Promise<IntentResult<unknown>> {
    if (signal.aborted) return failure('cancelled', 'request_cancelled')
    let endpoint: string
    try { endpoint = apiEndpoint(options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '', `/api/v1/journey/intents${path}`) }
    catch { return failure('configuration', 'invalid_api_configuration') }
    if (session && (!/^[a-f0-9]{32}$/.test(session.draftId) || !/^[A-Za-z0-9_-]{16,200}$/.test(session.token))) return failure('invalid_response', 'invalid_intent_request')
    const body = payload === undefined ? undefined : JSON.stringify(payload)
    if (body && new TextEncoder().encode(body).length > 16384) return failure('invalid_response', 'request_too_large')
    try {
      const response = await (options.fetcher ?? fetch)(endpoint, {
        method: payload === undefined ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal,
        headers: { Accept: 'application/json', ...(payload ? { 'Content-Type': 'application/json' } : {}),
          ...(session ? { Authorization: `Bearer ${session.token}` } : {}) }, ...(body === undefined ? {} : { body }),
      })
      if (signal.aborted) return failure('cancelled', 'request_cancelled')
      const value: unknown = await response.json().catch(() => null)
      if (signal.aborted) return failure('cancelled', 'request_cancelled')
      if (!response.ok) {
        if (isApiError(value)) return { ok: false, failure: { kind: 'api', status: response.status,
          error: localError(value.error.code, intentError(value.error.code)) } }
        if ([404, 405, 501].includes(response.status)) return failure('route_unavailable', 'intent_route_unavailable', response.status)
        return failure('invalid_response', 'invalid_intent_response', response.status)
      }
      if (response.status !== (path === '' ? 201 : 200)) return failure('invalid_response', 'invalid_intent_response', response.status)
      return { ok: true, value }
    } catch { return signal.aborted ? failure('cancelled', 'request_cancelled') : failure('network', 'network_unavailable') }
  }
  const validSession = (session: IntentSession, previous: IntentView) => session.draftId === previous.draft_id
  const invalid = () => failure('invalid_response', 'invalid_intent_response')
  async function operation(kind: 'get' | 'revise' | 'confirm' | 'reject', session: IntentSession, previous: IntentView,
    signal: AbortSignal, payload?: ReviseIntent | ConfirmIntent | VersionRequest): Promise<IntentResult<IntentView>> {
    if (!validSession(session, previous)) return invalid()
    if (payload && (payload.expected_revision !== previous.revision
      || !requestValidators[kind === 'revise' ? 'ReviseIntent' : kind === 'confirm' ? 'ConfirmIntent' : 'VersionRequest']!(payload))) return invalid()
    if (kind === 'revise') {
      const p = payload as ReviseIntent
      if ((p.message != null) === (p.changes != null) || (p.changes != null && !Object.keys(p.changes).length) || (p.message != null && !p.message.trim())) return invalid()
    }
    if (kind === 'confirm' && !executableIntent(previous)) return invalid()
    const result = await send(`/${session.draftId}${kind === 'get' ? '' : `/${kind}`}`, signal, session, payload)
    if (!result.ok) return result
    const value = result.value
    if (!validView(value) || value.draft_id !== previous.draft_id || value.expires_at !== previous.expires_at) return invalid()
    if (kind === 'get' ? value.revision < previous.revision : value.revision !== previous.revision + (kind === 'revise' || kind === 'reject' ? 1 : 0)) return invalid()
    if (kind === 'confirm' && (value.status !== 'confirmed' || !sameValue({ ...value, status: previous.status }, previous))) return invalid()
    if (kind === 'reject' && (value.status !== 'rejected' || !sameValue(value.fields, previous.fields) || !sameValue(value.criteria, previous.criteria))) return invalid()
    if (kind === 'revise' && ['confirmed', 'rejected'].includes(value.status)) return invalid()
    return { ok: true, value }
  }
  return {
    async create(payload, signal) {
      if (!requestValidators.CreateIntent!(payload) || !payload.message.trim()) return invalid()
      const result = await send('', signal, undefined, payload)
      if (!result.ok) return result
      const value = result.value
      return isCreated(value) && validView(value.draft) && value.draft.revision === 0
        && !['confirmed', 'rejected'].includes(value.draft.status) && /^[A-Za-z0-9_-]{16,200}$/.test(value.access_token)
        ? { ok: true, value } : invalid()
    },
    get: (session, previous, signal) => operation('get', session, previous, signal),
    revise: (session, previous, payload, signal) => operation('revise', session, previous, signal, payload),
    confirm: (session, previous, payload, signal) => operation('confirm', session, previous, signal, payload),
    reject: (session, previous, payload, signal) => operation('reject', session, previous, signal, payload),
    async recommendations(session, confirmed, signal) {
      if (!validSession(session, confirmed) || confirmed.status !== 'confirmed' || !executableIntent(confirmed)) return invalid()
      const result = await send(`/${session.draftId}/recommendations`, signal, session, { expected_revision: confirmed.revision })
      if (!result.ok) return result
      const value = result.value
      const request: ShoppingRequest = { request_id: confirmed.draft_id, revision: confirmed.revision, criteria: confirmed.criteria }
      return isJourneyResponse(value) && value.state.request_id === request.request_id
        && value.state.revision === request.revision && value.state.status === 'recommendations_ready' && value.state.search_performed === true
        && responseMatchesRequest(value, request) ? { ok: true, value: value as JourneyRecommendations } : invalid()
    },
  }
}
