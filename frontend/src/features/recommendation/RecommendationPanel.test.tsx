import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { RecommendationPanelProps } from '../../contracts'
import { acceptedJourneyFixture, journeyFixture } from '../../test/fixtures/contracts'
import { responseEntries } from '../../journey/operations'
import { RecommendationPanel } from './RecommendationPanel'
import { offerHash } from './presentation'

afterEach(() => { window.history.replaceState(null, '', '/') })
function props(overrides: Partial<RecommendationPanelProps> = {}): RecommendationPanelProps {
  return { requestId: 'panel-test', revision: 7, status: 'ready', response: structuredClone(acceptedJourneyFixture.result), comparison: [], error: null,
    onComparisonChange: vi.fn(), onRetry: vi.fn(), onViewVerification: vi.fn(), onAcceptAlternative: vi.fn(), ...overrides }
}

it('keeps backend order and full identities even for identical titles, unknown prices and zero prices', async () => {
  const p = props()
  const first = p.response!.original.recommendations[0]!
  const second = structuredClone(first)
  second.offer_id = second.candidate.offer_id = 'another-offer'
  second.candidate.price_toman = null
  first.candidate.price_toman = 0
  p.response!.original.recommendations.push(second)
  const user = userEvent.setup()
  const view = render(<RecommendationPanel {...p} />)
  const cards = screen.getAllByRole('article')
  expect(cards).toHaveLength(2)
  expect(within(cards[0]!).getByText('۰')).toBeVisible()
  expect(within(cards[1]!).getByText('نامشخص')).toBeVisible()
  const keys = responseEntries(p.response!).map(entry => entry.key)
  await user.click(within(cards[1]!).getByRole('checkbox'))
  expect(p.onComparisonChange).toHaveBeenLastCalledWith([keys[1]])
  expect(within(cards[1]!).getByRole('checkbox')).not.toBeChecked()
  view.rerender(<RecommendationPanel {...p} comparison={[keys[1]!]} />)
  expect(within(cards[1]!).getByRole('checkbox')).toBeChecked()
  await user.click(within(cards[1]!).getByRole('checkbox'))
  expect(p.onComparisonChange).toHaveBeenLastCalledWith([])
  expect(p.onAcceptAlternative).not.toHaveBeenCalled()
})

it('resolves explanation by current tuple and displays owning reasons, limitations and exact budget', () => {
  const p = props()
  const entry = responseEntries(p.response!)[0]!
  p.response!.original_constraints.max_budget = '19000000.123456789'
  window.history.replaceState(null, '', offerHash('explanation', entry.key))
  const view = render(<RecommendationPanel {...p} />)
  const explanation = screen.getByRole('region', { name: 'انتخابی با دلیل روشن' })
  for (const reason of entry.result.explanation_reasons) expect(within(explanation).getByText(reason.message)).toBeVisible()
  for (const limitation of entry.result.data_limitations) expect(within(explanation).getByText(limitation.message)).toBeVisible()
  expect(within(explanation).getByText(/۱۹٬۰۰۰٬۰۰۰٫۱۲۳۴۵۶۷۸۹/)).toBeVisible()
  p.response!.original.context.dataset!.dataset_id = 'replacement'
  view.rerender(<RecommendationPanel {...p} revision={8} />)
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.getByText('این پیشنهاد در نتیجهٔ فعلی در دسترس نیست')).toBeVisible()
})

it('keeps returned alternatives separate from original results with a working review route', () => {
  render(<RecommendationPanel {...props({ response: structuredClone(journeyFixture.result) })} />)
  expect(screen.getByText('در این جست‌وجو، گزینهٔ مناسبی پیدا نشد')).toBeVisible()
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /دیدن جایگزین‌ها/ })).toHaveAttribute('href', '#alternatives')
  for (const diagnosis of journeyFixture.result.diagnoses) expect(screen.getByText(diagnosis.message)).toBeVisible()
})

it('hides all old results while loading/error/idle and retries only the supplied identity and revision', async () => {
  const p = props()
  const user = userEvent.setup()
  const view = render(<RecommendationPanel {...p} />)
  view.rerender(<RecommendationPanel {...p} status="loading" />)
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('در حال بررسی')
  view.rerender(<RecommendationPanel {...p} status="error" error={{ error: { code: 'network_unavailable', message: 'ارتباط با سرویس برقرار نشد.' } }} revision={8} />)
  await user.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
  expect(p.onRetry).toHaveBeenCalledWith('panel-test', 8)
  expect(screen.getByRole('alert')).toHaveTextContent('ارتباط با سرویس برقرار نشد.')
  view.rerender(<RecommendationPanel {...p} status="idle" />)
  expect(view.container).toBeEmptyDOMElement()
})

it('does not create selectable identities without provenance and retains source warnings', async () => {
  const p = props()
  p.response!.original.context.dataset = null
  render(<RecommendationPanel {...p} />)
  expect(screen.getByRole('article')).toBeVisible()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  await userEvent.click(screen.getByText('منبع، پوشش و محدودیت‌های اطلاعات'))
  for (const warning of p.response!.warnings) expect(screen.getByText(warning)).toBeVisible()
})

it('uses only recorded product media with a neutral fallback on image failure', () => {
  const p = props()
  p.response!.original.recommendations[0]!.candidate.product.image_urls = ['javascript:alert(1)', 'https://example.invalid/recorded.png']
  render(<RecommendationPanel {...p} />)
  const img = screen.getByRole('img')
  expect(img).toHaveAttribute('src', 'https://example.invalid/recorded.png')
  fireEvent.error(img)
  expect(screen.getByRole('img')).toHaveAccessibleName('تصویر ثبت‌شدهٔ کالا در دسترس نیست')
  expect(document.querySelector('img')).toBeNull()
})

it('enforces the existing ten-selection boundary while allowing deselection', async () => {
  const p = props()
  const entry = responseEntries(p.response!)[0]!
  const comparison = Array.from({ length: 10 }, (_, i) => ({ ...entry.key, offer_id: `selected-${i}` }))
  const view = render(<RecommendationPanel {...p} comparison={comparison} />)
  expect(screen.getByRole('checkbox')).toBeDisabled()
  comparison[0] = entry.key
  view.rerender(<RecommendationPanel {...p} comparison={comparison} />)
  expect(screen.getByRole('checkbox')).toBeEnabled()
  await userEvent.click(screen.getByRole('checkbox'))
  expect(p.onComparisonChange).toHaveBeenCalledWith(comparison.slice(1))
})

it('restores focus to the owning result action after returning from explanation', async () => {
  const p = props()
  const entry = responseEntries(p.response!)[0]!
  render(<RecommendationPanel {...p} />)
  act(() => {
    window.location.hash = offerHash('explanation', entry.key)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  expect(screen.getByRole('heading', { name: 'چرا این پیشنهاد برای تو مناسب است؟' })).toHaveFocus()
  act(() => { window.location.hash = 'results'; window.dispatchEvent(new HashChangeEvent('hashchange')) })
  expect(screen.getByRole('link', { name: 'دلیل این پیشنهاد' })).toHaveFocus()
})
