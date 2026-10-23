import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { ProductDetail, RecommendationPanelProps } from '../../contracts'
import type { ProductDetailClient, ProductDetailResult } from '../../api/productDetail'
import { acceptedJourneyFixture, journeyFixture, productDetailFixture } from '../../test/fixtures/contracts'
import { responseEntries } from '../../journey/operations'
import { RecommendationPanel } from './RecommendationPanel'
import { ProductDetails } from './ProductDetails'
import { Specifications } from './Specifications'
import { offerHash } from './presentation'

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
function props(alternative = false): RecommendationPanelProps {
  return { requestId: 'detail-test', revision: 3, status: 'ready', response: structuredClone(alternative ? journeyFixture.result : acceptedJourneyFixture.result),
    comparison: [], error: null, onComparisonChange: vi.fn(), onRetry: vi.fn(), onAcceptAlternative: vi.fn(), onViewVerification: vi.fn() }
}
function detailFor(p: RecommendationPanelProps, index = 0): ProductDetail {
  const entry = responseEntries(p.response!)[index]!
  return { item: { ...entry.result.candidate.product, specs: productDetailFixture.item.specs ?? [] }, context: p.response!.original.context }
}
function navigate(hash: string) {
  act(() => { window.location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')) })
}

it('renders nested/unknown JSON as escaped text, preserving units, repeats, zero, false and empty values', () => {
  const text = '<img src=x onerror=alert(1)>'
  const deep = { a: { b: { c: { d: { e: { f: { g: text } } } } } } }
  const { container } = render(<Specifications specs={[
    { section: 'حافظه', key: 'ظرفیت', value: 0, unit: 'GB', enabled: false },
    { section: 'حافظه', key: 'ظرفیت', value: 0, unit: 'GB', enabled: false },
    { nested: [null, '', [], {}, { unknown: text }], constructor: 'recorded', deep }, {},
  ]} />)
  expect(screen.getAllByText('0')).toHaveLength(2)
  expect(screen.getAllByText('false')).toHaveLength(2)
  expect(screen.getAllByText('GB')).toHaveLength(2)
  expect(screen.getByText('مقدار تهی (null)')).toBeVisible()
  expect(screen.getByText('رشتهٔ خالی ("")')).toBeVisible()
  expect(screen.getByText('فهرست خالی ([])')).toBeVisible()
  expect(screen.getAllByText('رکورد خالی ({})')).toHaveLength(2)
  expect(screen.getByText('constructor')).toBeVisible()
  expect(screen.getByText(text)).toBeVisible()
  expect(container.querySelector('pre')).toHaveTextContent(text)
  expect(container.querySelector('img, script')).toBeNull()
})

it.each([false, true])('opens original/alternative details without acceptance or search and restores focus (alternative=%s)', async alternative => {
  const p = props(alternative)
  const entry = responseEntries(p.response!)[0]!
  window.history.replaceState(null, '', alternative ? '#alternatives' : '#results')
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(detailFor(p)))
  vi.stubGlobal('fetch', fetcher)
  const view = render(<RecommendationPanel {...p} comparison={[entry.key]} />)
  const opening = screen.getAllByRole('link', { name: 'مشخصات کالا' })[0]!
  expect(opening).toHaveAttribute('href', offerHash('product', entry.key))
  navigate(offerHash('product', entry.key))
  expect(screen.getByRole('heading', { name: 'جزئیات کالای ثبت‌شده' })).toHaveFocus()
  expect(await screen.findByText('ساختگی', { selector: 'bdi' })).toBeVisible()
  expect(screen.getByRole('checkbox')).toBeChecked()
  const seller = screen.getByRole('region', { name: 'آفر انتخاب‌شده و شرایط فروش' })
  expect(within(seller).getByText(entry.result.candidate.shop.name)).toBeVisible()
  expect(within(seller).getByText(entry.key.offer_id)).toBeVisible()
  expect(within(seller).getByText('موجودی تأیید نشده')).toBeVisible()
  await userEvent.click(screen.getByRole('checkbox'))
  expect(p.onComparisonChange).toHaveBeenCalledWith([])
  view.rerender(<RecommendationPanel {...p} comparison={[]} />)
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(p.onAcceptAlternative).not.toHaveBeenCalled()
  expect(p.onRetry).not.toHaveBeenCalled()
  expect(p.onViewVerification).not.toHaveBeenCalled()
  navigate(alternative ? '#alternatives' : '#results')
  expect(screen.getAllByRole('link', { name: 'مشخصات کالا' })[0]).toHaveFocus()
})

it.each([404, 503, 200])('keeps offer/comparison while handling failure %s and retrying to empty specs', async status => {
  const p = props()
  const entry = responseEntries(p.response!)[0]!
  window.history.replaceState(null, '', offerHash('product', entry.key))
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(status === 200 ? { invalid: true } : { error: { code: 'catalog_unavailable', message: 'private <script>', details: [] } }, status))
    .mockResolvedValueOnce(json({ ...detailFor(p), item: { ...detailFor(p).item, specs: [] } }))
  vi.stubGlobal('fetch', fetcher)
  render(<RecommendationPanel {...p} comparison={[entry.key]} />)
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private')
  expect(screen.getByRole('checkbox')).toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: 'تلاش دوباره برای مشخصات' }))
  expect(await screen.findByText('مشخصاتی در این رکورد ثبت نشده است.')).toBeVisible()
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(p.onRetry).not.toHaveBeenCalled()
})

it.each(['product', 'dataset'])('shows explicit incompatible state without attaching mismatched %s specs', async field => {
  const p = props()
  const entry = responseEntries(p.response!)[0]!
  const detail = detailFor(p)
  if (field === 'product') detail.item.product_id = 'other'
  else detail.context = { ...detail.context, dataset: { ...detail.context.dataset!, source_sha256: 'other' } }
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(json(detail)))
  window.history.replaceState(null, '', offerHash('product', entry.key))
  render(<RecommendationPanel {...p} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('سازگار نیست')
  expect(screen.queryByText('ساختگی', { selector: 'bdi' })).toBeNull()
})

it('ignores late responses when product, request/revision or response owner changes, even if transport ignores abort', async () => {
  const p = props(true)
  const entries = responseEntries(p.response!)
  const pending: { resolve: (value: ProductDetailResult) => void; signal: AbortSignal }[] = []
  const detailClient = vi.fn<ProductDetailClient>((_id, _context, signal) => new Promise<ProductDetailResult>(resolve => { pending.push({ resolve, signal }) }))
  const shared = { response: p.response!, requestId: p.requestId, revision: p.revision, selected: true, selectionDisabled: false, onToggle: vi.fn(), previousHash: '#alternatives', detailClient }
  const first = entries[0]!
  const second = entries.find(item => item.key.product_id !== first.key.product_id)!
  expect(second).toBeDefined()
  const view = render(<ProductDetails {...shared} entry={first} />)
  view.rerender(<ProductDetails {...shared} entry={second} />)
  expect(pending[0]!.signal.aborted).toBe(true)
  await act(async () => pending[0]!.resolve({ ok: true, value: { ...detailFor(p), item: { ...detailFor(p).item, specs: [{ value: 'OLD PRODUCT' }] } } }))
  expect(screen.queryByText('OLD PRODUCT')).toBeNull()
  const nextResponse = structuredClone(p.response!)
  view.rerender(<ProductDetails {...shared} response={nextResponse} entry={second} requestId="new-request" revision={4} />)
  expect(pending[1]!.signal.aborted).toBe(true)
  await act(async () => pending[1]!.resolve({ ok: true, value: { item: { ...second.result.candidate.product, specs: [{ value: 'OLD REVISION' }] }, context: shared.response.original.context } }))
  expect(screen.queryByText('OLD REVISION')).toBeNull()
  await act(async () => pending[2]!.resolve({ ok: true, value: { item: { ...second.result.candidate.product, specs: [{ value: 'CURRENT' }] }, context: nextResponse.original.context } }))
  expect(screen.getByText('CURRENT')).toBeVisible()
  // Even a same-identity response replacement hides loaded records synchronously.
  view.rerender(<ProductDetails {...shared} response={structuredClone(nextResponse)} entry={second} requestId="new-request" revision={4} />)
  expect(screen.queryByText('CURRENT')).toBeNull()
})

it('cancels on editing criteria and rejects stale/missing route context without losing the panel', async () => {
  const p = props()
  const entry = responseEntries(p.response!)[0]!
  let resolve!: (response: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(done => { resolve = done }))
  vi.stubGlobal('fetch', fetcher)
  window.history.replaceState(null, '', offerHash('product', entry.key))
  const view = render(<RecommendationPanel {...p} />)
  expect(screen.getByText('در حال دریافت مشخصات ثبت‌شده…')).toBeVisible()
  navigate('#edit-search')
  expect(fetcher.mock.calls[0]![1]!.signal!.aborted).toBe(true)
  await act(async () => resolve(json(detailFor(p))))
  expect(screen.queryByText('ساختگی', { selector: 'bdi' })).toBeNull()
  navigate(offerHash('product', { ...entry.key, dataset_id: 'stale' }))
  expect(screen.getByText('این پیشنهاد در نتیجهٔ فعلی در دسترس نیست')).toBeVisible()
  view.rerender(<RecommendationPanel {...p} response={{ ...p.response!, original: { ...p.response!.original, context: { ...p.response!.original.context, dataset: null } } }} />)
  expect(screen.getByText('این پیشنهاد در نتیجهٔ فعلی در دسترس نیست')).toBeVisible()
  expect(fetcher).toHaveBeenCalledTimes(1)
})
