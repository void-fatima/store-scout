import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { RecommendationPanelProps } from '../../contracts'
import { acceptedJourneyFixture, journeyFixture } from '../../test/fixtures/contracts'
import { responseEntries } from '../../journey/operations'
import { RecommendationPanel } from './RecommendationPanel'
import { offerHash, productHash } from './presentation'

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
function setup(alternative = false) {
  const response = structuredClone((alternative ? journeyFixture : acceptedJourneyFixture).result)
  const entry = responseEntries(response)[0]!
  const props: RecommendationPanelProps = { requestId: 'product-tabs', revision: 3, response, status: 'ready', comparison: [entry.key], error: null,
    onComparisonChange: vi.fn(), onRetry: vi.fn(), onAcceptAlternative: vi.fn(), onViewVerification: vi.fn() }
  return { props, entry, detail: { context: response.original.context, item: { ...entry.result.candidate.product, specs: [{ value: 'RECORDED SPEC' }] } } }
}
function navigate(hash: string) {
  act(() => { window.location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')) })
}

it('keeps the same in-flight GET and selected offer across fit/specs tabs with RTL keyboard focus', async () => {
  const { props, entry, detail } = setup()
  let resolve!: (response: Response) => void
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(done => { resolve = done }))
  vi.stubGlobal('fetch', fetcher)
  window.history.replaceState(null, '', '#results')
  render(<RecommendationPanel {...props} />)
  navigate(productHash(entry.key, 'specs'))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  const specs = screen.getByRole('tab', { name: 'مشخصات کالا' })
  const fit = screen.getByRole('tab', { name: 'تناسب با نیاز من' })
  expect(specs).toHaveAttribute('aria-selected', 'true')
  expect(fit).toHaveAttribute('tabindex', '-1')
  specs.focus()
  await userEvent.keyboard('{ArrowLeft}')
  await waitFor(() => expect(fit).toHaveAttribute('aria-selected', 'true'))
  expect(fit).toHaveFocus()
  const panel = screen.getByRole('tabpanel', { name: 'تناسب با نیاز من' })
  expect(panel).toHaveAttribute('id', fit.getAttribute('aria-controls'))
  for (const reason of entry.result.explanation_reasons) expect(within(panel).getByText(reason.message)).toBeVisible()
  expect(screen.getByRole('checkbox')).toBeChecked()
  await act(async () => resolve(json(detail)))
  expect(screen.getByText('RECORDED SPEC')).not.toBeVisible()
  await userEvent.keyboard('{ArrowRight}')
  await waitFor(() => expect(specs).toHaveFocus())
  expect(screen.getByText('RECORDED SPEC')).toBeVisible()
  await userEvent.click(fit)
  await waitFor(() => expect(fit).toHaveFocus())
  await userEvent.keyboard('{Home}')
  await waitFor(() => expect(specs).toHaveAttribute('aria-selected', 'true'))
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(props.onAcceptAlternative).not.toHaveBeenCalled()
  expect(props.onRetry).not.toHaveBeenCalled()
  expect(props.onViewVerification).not.toHaveBeenCalled()
})

it.each([false, true])('keeps valid fit content usable after a specs failure and returns to the owning action (alternative=%s)', async alternative => {
  const { props, entry } = setup(alternative)
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ error: { code: 'catalog_unavailable', message: 'private', details: [] } }, 503))
  vi.stubGlobal('fetch', fetcher)
  window.history.replaceState(null, '', alternative ? '#alternatives' : '#results')
  render(<RecommendationPanel {...props} />)
  navigate(productHash(entry.key, 'specs'))
  expect(await screen.findByRole('alert')).toHaveTextContent('موقتاً')
  navigate(productHash(entry.key, 'fit'))
  expect(screen.getByRole('tab', { name: 'تناسب با نیاز من' })).toHaveFocus()
  for (const reason of entry.result.explanation_reasons) expect(screen.getByText(reason.message)).toBeVisible()
  if (alternative) expect(screen.getByRole('link', { name: 'بررسی و پذیرش صریح تغییرهای جایگزین' })).toHaveAttribute('href', offerHash('alternative', entry.key))
  expect(screen.getByRole('checkbox')).toBeChecked()
  navigate(alternative ? '#alternatives' : '#results')
  expect(screen.getAllByRole('link', { name: 'مشخصات کالا' })[0]).toHaveFocus()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(props.onAcceptAlternative).not.toHaveBeenCalled()
  expect(props.onRetry).not.toHaveBeenCalled()
})
