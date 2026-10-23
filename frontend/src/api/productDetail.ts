import type { CatalogContext, ProductDetail } from '../contracts'
import { sameValue } from '../journey/operations'
import { apiEndpoint, localError } from './journey'
import type { JourneyFailure } from './journey'
import { isApiError, isProductDetail } from './validation'

export type ProductDetailResult = { ok: true; value: ProductDetail } | { ok: false; failure: JourneyFailure }
export type ProductDetailClient = (productId: string, context: CatalogContext, signal: AbortSignal) => Promise<ProductDetailResult>

/** The entire recorded dataset identity (including import/hash) must agree. */
export function compatibleProduct(detail: ProductDetail, productId: string, context: CatalogContext): boolean {
  return detail.item.product_id === productId && !!context.dataset && !!detail.context.dataset
    && detail.context.contract_version === context.contract_version
    && detail.context.currency === context.currency && sameValue(detail.context.dataset, context.dataset)
}

export function createProductDetailClient(options: { baseUrl?: string; fetcher?: typeof fetch } = {}): ProductDetailClient {
  return async (productId, context, signal) => {
    const fail = (kind: JourneyFailure['kind'], code: string, message: string, status?: number): ProductDetailResult => ({
      ok: false, failure: { kind, error: localError(code, message), ...(status === undefined ? {} : { status }) },
    })
    const cancelled = () => fail('cancelled', 'request_cancelled', 'درخواست لغو شد.')
    if (signal.aborted) return cancelled()
    if (!context.dataset || !productId.trim()) return fail('invalid_response', 'product_context_unavailable', 'منبع فعلی کالا در دسترس نیست.')
    let endpoint: string
    try {
      endpoint = apiEndpoint(options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? '', `/api/v1/catalog/products/${encodeURIComponent(productId)}`)
    } catch {
      return fail('configuration', 'invalid_api_configuration', 'نشانی سرویس درست تنظیم نشده است.')
    }
    try {
      const response = await (options.fetcher ?? fetch)(endpoint, {
        method: 'GET', credentials: 'omit', signal, headers: { Accept: 'application/json' },
      })
      if (signal.aborted) return cancelled()
      if (response.status === 404) return fail('api', 'product_not_found', 'رکورد کالا در منبع فعلی پیدا نشد.', 404)
      const data: unknown = await response.json().catch(() => null)
      if (signal.aborted) return cancelled()
      if (!response.ok && isApiError(data)) return { ok: false, failure: { kind: 'api', status: response.status, error: data } }
      if (response.status !== 200 || !isProductDetail(data)) return fail('invalid_response', 'invalid_product_response', 'پاسخ معتبر برای مشخصات کالا دریافت نشد.', response.status)
      if (!compatibleProduct(data, productId, context)) return fail('invalid_response', 'product_snapshot_changed', 'مشخصات با کالا یا منبع این جست‌وجو سازگار نیست. جست‌وجو را تازه کن.', response.status)
      return { ok: true, value: data }
    } catch {
      return signal.aborted ? cancelled() : fail('network', 'network_unavailable', 'ارتباط با سرویس برقرار نشد. دوباره تلاش کن.')
    }
  }
}
