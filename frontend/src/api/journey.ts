import type { ErrorResponse, JourneyRecommendations, ShoppingRequest } from '../contracts'
import { isApiError, isJourneyResponse } from './validation'

export type JourneyFailure = Readonly<{
  kind: 'api' | 'network' | 'cancelled' | 'invalid_response' | 'route_unavailable' | 'configuration'
  error: ErrorResponse
  status?: number
}>
export type JourneyResult = { ok: true; value: JourneyRecommendations } | { ok: false; failure: JourneyFailure }
export type JourneyClient = (request: ShoppingRequest, signal: AbortSignal) => Promise<JourneyResult>

export function localError(code: string, message: string): ErrorResponse {
  return { error: { code, message, details: [] } }
}

function failure(kind: JourneyFailure['kind'], code: string, message: string, status?: number): JourneyResult {
  return { ok: false, failure: { kind, error: localError(code, message), ...(status === undefined ? {} : { status }) } }
}

export function apiEndpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (!base) return '/api/v1/journey/recommendations'
  const url = new URL(base)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid API configuration')
  }
  return `${base}/api/v1/journey/recommendations`
}

export function createJourneyClient(options: { baseUrl?: string; fetcher?: typeof fetch } = {}): JourneyClient {
  return async (request, signal) => {
    if (signal.aborted) return failure('cancelled', 'request_cancelled', 'درخواست لغو شد.')
    let endpoint: string
    try {
      endpoint = apiEndpoint(options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '')
    } catch {
      return failure('configuration', 'invalid_api_configuration', 'نشانی سرویس درست تنظیم نشده است.')
    }
    try {
      const response = await (options.fetcher ?? fetch)(endpoint, {
        method: 'POST', credentials: 'omit', signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(request),
      })
      if (signal.aborted) return failure('cancelled', 'request_cancelled', 'درخواست لغو شد.')
      if ([404, 405, 501].includes(response.status)) {
        return failure('route_unavailable', 'journey_route_unavailable', 'مسیر راهنمای خرید در این سرویس در دسترس نیست.', response.status)
      }
      const data: unknown = await response.json().catch(() => null)
      if (signal.aborted) return failure('cancelled', 'request_cancelled', 'درخواست لغو شد.')
      if (!response.ok && isApiError(data)) {
        return { ok: false, failure: { kind: 'api', status: response.status, error: data } }
      }
      if (response.status !== 200 || !isJourneyResponse(data)
        || data.state.request_id !== request.request_id
        || (data.state.revision ?? 0) !== (request.revision ?? 0)
        || data.state.status !== 'recommendations_ready' || data.state.search_performed !== true) {
        return failure('invalid_response', 'invalid_journey_response', 'پاسخ معتبر از سرویس دریافت نشد.', response.status)
      }
      return { ok: true, value: data }
    } catch {
      return signal.aborted
        ? failure('cancelled', 'request_cancelled', 'درخواست لغو شد.')
        : failure('network', 'network_unavailable', 'ارتباط با سرویس برقرار نشد. دوباره تلاش کنید.')
    }
  }
}

/** Only local, reviewed text reaches UI; raw HTTP bodies/exceptions stay hidden. */
export function userError(error: ErrorResponse): ErrorResponse {
  const messages: Record<string, string> = {
    catalog_snapshot_changed: 'داده‌های فروشگاه‌ها تغییر کرده‌اند. جست‌وجوی تازه‌ای انجام دهید.',
    missing_information: 'اطلاعات لازم برای جست‌وجو را کامل کنید.',
    invalid_request: 'اطلاعات فرم را بررسی کنید.',
    unsupported_constraint: 'بعضی معیارها در این سرویس پشتیبانی نمی‌شوند.',
    invalid_recommendation_input: 'معیارهای جست‌وجو معتبر نیستند.',
    catalog_unavailable: 'اطلاعات فروشگاه‌ها موقتاً در دسترس نیست.',
    catalog_time_limit: 'زمان پاسخ‌گویی سرویس تمام شد. دوباره تلاش کنید.',
    journey_route_unavailable: 'مسیر راهنمای خرید در این سرویس در دسترس نیست.',
    network_unavailable: 'ارتباط با سرویس برقرار نشد. دوباره تلاش کنید.',
    invalid_api_configuration: 'نشانی سرویس درست تنظیم نشده است.',
  }
  const fallback = 'درخواست انجام نشد. دوباره تلاش کنید.'
  return localError(error.error.code, Object.hasOwn(messages, error.error.code) ? messages[error.error.code] ?? fallback : fallback)
}
