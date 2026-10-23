import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { RecommendationPanelProps } from '../../contracts'
import type { JourneyClient } from '../../api/journey'
import { acceptedJourneyFixture, journeyFixture } from '../../test/fixtures/contracts'
import { associatedFixture } from '../../test/journey-fixtures'
import { responseEntries } from '../../journey/operations'
import { useJourneyController } from '../../journey/useJourneyController'
import { emptyDraft } from '../../journey/criteria'
import { JourneyFlow } from '../../journey/JourneyFlow'
import { RecommendationPanel } from './RecommendationPanel'
import { VerificationContext } from './VerificationContext'
import { productHash } from './presentation'

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })
function setup(alternative = false) {
  const response = structuredClone((alternative ? journeyFixture : acceptedJourneyFixture).result)
  const entry = responseEntries(response)[0]!
  const props: RecommendationPanelProps = { requestId: 'purchase-ui', revision: 7, response, comparison: [entry.key], status: 'ready', error: null,
    onComparisonChange: vi.fn(), onRetry: vi.fn(), onAcceptAlternative: vi.fn(), onViewVerification: vi.fn() }
  vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'catalog_unavailable', message: 'private', details: [] } }), { status: 503 })))
  window.history.replaceState(null, '', productHash(entry.key, 'specs'))
  return { props, entry }
}
function navigate(hash: string) {
  act(() => { window.location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')) })
}

it.each([false, true])('selects only the current owning plan, keeps focus, and resets personal checks on leaving purchase (alternative=%s)', async alternative => {
  const { props, entry } = setup(alternative)
  const originalPlan = structuredClone(entry.plan!)
  const view = render(<VerificationContext value={null}><RecommendationPanel {...props} /></VerificationContext>)
  await screen.findByRole('alert') // A specs failure cannot block the plan.
  navigate(productHash(entry.key, 'purchase'))
  expect(props.onViewVerification).toHaveBeenCalledExactlyOnceWith(entry.key, entry.plan)
  const purchase = screen.getByRole('tab', { name: 'قبل از خرید بررسی کن' })
  expect(purchase).toHaveFocus()
  expect(screen.queryByRole('checkbox', { name: /^یادآوری شخصی:/ })).not.toBeInTheDocument()
  view.rerender(<VerificationContext value={{ key: entry.key, plan: entry.plan! }}><RecommendationPanel {...props} /></VerificationContext>)
  expect(purchase).toHaveFocus()
  const panel = screen.getByRole('tabpanel', { name: 'قبل از خرید بررسی کن' })
  for (const item of entry.plan!.checklist) expect(within(panel).getByText(item.question, { exact: true })).toBeVisible()
  const reminders = within(panel).getAllByRole('checkbox', { name: /^یادآوری شخصی:/ })
  await userEvent.click(reminders[0]!)
  expect(reminders[0]).toBeChecked()
  expect(within(panel).getAllByText('در انتظار بررسی', { exact: true })).toHaveLength(entry.plan!.checklist.length)
  expect(entry.plan).toEqual(originalPlan)
  expect(within(panel).getByText(/تماسی با فروشنده انجام نشده است/)).toBeVisible()
  expect(screen.queryByRole('link', { name: /تماس|مسیریابی/ })).not.toBeInTheDocument()
  navigate(productHash(entry.key, 'fit'))
  navigate(productHash(entry.key, 'purchase'))
  expect(screen.getAllByRole('checkbox', { name: /^یادآوری شخصی:/ })[0]).not.toBeChecked()
  expect(props.onViewVerification).toHaveBeenCalledTimes(1)
  expect(props.onAcceptAlternative).not.toHaveBeenCalled()
  expect(props.onRetry).not.toHaveBeenCalled()
})

it('rejects a stale controller plan, resets on revision/owner replacement and removes old snapshot questions', async () => {
  const { props, entry } = setup()
  const selected = { key: entry.key, plan: entry.plan! }
  window.history.replaceState(null, '', productHash(entry.key, 'purchase'))
  const view = render(<VerificationContext value={selected}><RecommendationPanel {...props} /></VerificationContext>)
  await userEvent.click(screen.getAllByRole('checkbox', { name: /^یادآوری شخصی:/ })[0]!)
  view.rerender(<VerificationContext value={selected}><RecommendationPanel {...props} revision={8} /></VerificationContext>)
  expect(screen.getAllByRole('checkbox', { name: /^یادآوری شخصی:/ })[0]).not.toBeChecked()
  const replacement = structuredClone(props.response)!
  const nextEntry = responseEntries(replacement)[0]!
  view.rerender(<VerificationContext value={selected}><RecommendationPanel {...props} response={replacement} revision={8} /></VerificationContext>)
  expect(screen.queryByRole('checkbox', { name: /^یادآوری شخصی:/ })).not.toBeInTheDocument()
  expect(props.onViewVerification).toHaveBeenLastCalledWith(nextEntry.key, nextEntry.plan)
  view.rerender(<VerificationContext value={{ key: nextEntry.key, plan: nextEntry.plan! }}><RecommendationPanel {...props} response={replacement} revision={8} /></VerificationContext>)
  expect(screen.getAllByRole('checkbox', { name: /^یادآوری شخصی:/ })[0]).not.toBeChecked()
  replacement.original.context.dataset!.dataset_id = 'new-snapshot'
  view.rerender(<VerificationContext value={selected}><RecommendationPanel {...props} response={replacement} revision={9} /></VerificationContext>)
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  expect(screen.getByText('این پیشنهاد در نتیجهٔ فعلی در دسترس نیست')).toBeVisible()
})

it.each(['missing', 'incompatible'])('keeps %s verification explicit without inventing/selecting a plan', mode => {
  const { props, entry } = setup()
  if (entry.plan && props.response) {
    if (mode === 'missing') props.response.original_verification = []
    else entry.plan.product_id = 'wrong-product'
  }
  window.history.replaceState(null, '', productHash(entry.key, 'purchase'))
  render(<RecommendationPanel {...props} />)
  expect(screen.queryByRole('checkbox', { name: /^یادآوری شخصی:/ })).not.toBeInTheDocument()
  expect(props.onViewVerification).not.toHaveBeenCalled()
  expect(screen.getByRole('tabpanel', { name: 'قبل از خرید بررسی کن' })).toHaveTextContent(/در دسترس نیست|سازگار نیست/)
})

it('uses the real Journey controller selection and keeps comparison/criteria until a criteria edit invalidates them', async () => {
  const source = structuredClone(acceptedJourneyFixture)
  const criteria = source.result.original_constraints
  const client = vi.fn<JourneyClient>().mockImplementation(async request => ({ ok: true, value: associatedFixture(request, source) }))
  const product = source.result.original.recommendations[0]!.candidate.product
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ context: source.result.original.context, item: { ...product, specs: [] } })))
  vi.stubGlobal('fetch', fetcher)
  window.history.replaceState(null, '', '#results')
  function Harness() {
    const controller = useJourneyController({ client, requestId: 'purchase-controller', initialDraft: {
      ...emptyDraft(), query: criteria.query, budget: criteria.max_budget, priceUnit: criteria.price_unit,
      latitude: String(criteria.latitude), longitude: String(criteria.longitude), radius: criteria.max_distance_km == null ? '' : String(criteria.max_distance_km),
    } })
    return <><JourneyFlow controller={controller} Panel={RecommendationPanel} /><output aria-label="controller-plan">{controller.state.selectedVerification?.plan.offer_id ?? 'none'}</output>
      <output aria-label="controller-comparison">{controller.state.comparison.length}</output></>
  }
  render(<Harness />)
  await userEvent.click(screen.getByRole('button', { name: 'دیدن پیشنهادها' }))
  await screen.findByRole('article')
  await userEvent.click(screen.getByRole('checkbox', { name: /^مقایسهٔ/ }))
  const entry = responseEntries(source.result)[0]!
  navigate(productHash(entry.key, 'purchase'))
  expect(await screen.findByRole('region', { name: 'سؤال‌های پیش از خرید' })).toBeVisible()
  expect(screen.getByLabelText('controller-plan')).toHaveTextContent(entry.key.offer_id)
  expect(screen.getByLabelText('controller-comparison')).toHaveTextContent('1')
  expect(screen.getByRole('heading', { name: 'جزئیات کالای ثبت‌شده' })).toHaveFocus()
  navigate(productHash(entry.key, 'fit'))
  navigate(productHash(entry.key, 'specs'))
  await screen.findByText('مشخصاتی در این رکورد ثبت نشده است.')
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(client).toHaveBeenCalledTimes(1)
  navigate('#edit-search')
  await userEvent.clear(screen.getByLabelText('نام کالا'))
  expect(screen.getByLabelText('controller-plan')).toHaveTextContent('none')
  expect(screen.getByLabelText('controller-comparison')).toHaveTextContent('0')
  navigate(productHash(entry.key, 'purchase'))
  await waitFor(() => expect(screen.queryByRole('tab')).not.toBeInTheDocument())
  expect(client).toHaveBeenCalledTimes(1)
})
