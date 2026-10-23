import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import type { RecommendationPanelProps } from '../../contracts'
import { journeyFixture } from '../../test/fixtures/contracts'
import { responseEntries } from '../../journey/operations'
import { RecommendationPanel } from './RecommendationPanel'
import { ProposedChanges } from './Alternatives'
import { offerHash } from './presentation'

const dialogMethods = ['showModal', 'close'] as const
const originalMethods = dialogMethods.map(name => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name))
beforeAll(() => {
  // jsdom checks callbacks/state; native modal focus trapping is tested in Chromium.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open') } })
})
afterAll(() => { dialogMethods.forEach((name, index) => {
  const descriptor = originalMethods[index]
  if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor)
  else Reflect.deleteProperty(HTMLDialogElement.prototype, name)
}) })
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, '', '/') })
function scenario() {
  const response = structuredClone(journeyFixture.result)
  const p: RecommendationPanelProps = { response, requestId: 'alternative-ui', revision: 3, comparison: [], status: 'ready', error: null,
    onComparisonChange: vi.fn(), onViewVerification: vi.fn(), onAcceptAlternative: vi.fn(), onRetry: vi.fn() }
  const entry = responseEntries(response).find(item => item.source === 'alternative')!
  const suggestion = response.suggestions[0]!
  return { p, entry, suggestion }
}
function navigate(hash: string) {
  act(() => { window.location.hash = hash; window.dispatchEvent(new HashChangeEvent('hashchange')) })
}

it('renders ordered alternatives separately and comparing or viewing them does not accept changes', async () => {
  const { p } = scenario()
  window.history.replaceState(null, '', '#alternatives')
  render(<RecommendationPanel {...p} />)
  const entries = responseEntries(p.response!).filter(item => item.source === 'alternative')
  expect(screen.getAllByRole('article')).toHaveLength(p.response!.suggestions.length)
  expect(screen.getAllByRole('link', { name: 'بررسی تغییرهای این جایگزین' }).map(link => link.getAttribute('href')))
    .toEqual(entries.map(entry => offerHash('alternative', entry.key)))
  await userEvent.click(screen.getAllByRole('checkbox')[0]!)
  expect(p.onComparisonChange).toHaveBeenCalledWith([entries[0]!.key])
  expect(p.onAcceptAlternative).not.toHaveBeenCalled()
})

it('shows exact before/after values for query, monetary unit and radius, including unchanged fields', () => {
  const { suggestion } = scenario()
  suggestion.original_constraints.max_budget = '9007199254740993.123456789'
  suggestion.relaxed_constraints.max_budget = '9007199254740994.123456789'
  suggestion.original_constraints.price_unit = suggestion.relaxed_constraints.price_unit = 'IRR'
  suggestion.relaxed_constraints.query = 'مدل پیشنهادی'
  suggestion.original_constraints.max_distance_km = null
  suggestion.relaxed_constraints.max_distance_km = 5
  render(<ProposedChanges suggestion={suggestion} />)
  expect(screen.getByText('۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳٫۱۲۳۴۵۶۷۸۹ ریال')).toBeVisible()
  expect(screen.getByText('۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۴٫۱۲۳۴۵۶۷۸۹ ریال')).toBeVisible()
  expect(screen.getByText('مدل پیشنهادی')).toBeVisible()
  expect(screen.getByText('بدون شعاع مشخص')).toBeVisible()
  expect(screen.getByText('۵ کیلومتر')).toBeVisible()
})

it('cancels review without accepting and confirms exactly once using the canonical payload', async () => {
  const { p, entry, suggestion } = scenario()
  window.history.replaceState(null, '', offerHash('alternative', entry.key))
  const user = userEvent.setup()
  render(<RecommendationPanel {...p} />)
  const trigger = screen.getByRole('button', { name: 'مرور و تأیید تغییرها' })
  await user.click(trigger)
  let dialog = screen.getByRole('dialog')
  expect(within(dialog).getByRole('button', { name: 'پذیرش و جست‌وجوی تازه' })).toBeDisabled()
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(p.onAcceptAlternative).not.toHaveBeenCalled()
  expect(p.response!.original_constraints).toEqual(journeyFixture.result.original_constraints)
  await user.click(trigger)
  dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('checkbox'))
  const confirm = within(dialog).getByRole('button', { name: 'پذیرش و جست‌وجوی تازه' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  expect(p.onAcceptAlternative).toHaveBeenCalledExactlyOnceWith({ request_id: p.requestId, expected_revision: p.revision,
    dataset_id: entry.key.dataset_id, offer_id: entry.key.offer_id, accepted_changes: suggestion.changes })
})

it('invalidates an open confirmation when revision, snapshot or dataset changes', async () => {
  const { p, entry } = scenario()
  window.history.replaceState(null, '', offerHash('alternative', entry.key))
  const view = render(<RecommendationPanel {...p} />)
  await userEvent.click(screen.getByRole('button', { name: 'مرور و تأیید تغییرها' }))
  view.rerender(<RecommendationPanel {...p} revision={4} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'مرور و تأیید تغییرها' }))
  view.rerender(<RecommendationPanel {...p} revision={4} response={structuredClone(p.response)} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  const replacement = structuredClone(p.response)!
  replacement.original.context.dataset!.dataset_id = 'replacement-dataset'
  view.rerender(<RecommendationPanel {...p} revision={5} response={replacement} />)
  expect(screen.queryByRole('button', { name: 'مرور و تأیید تغییرها' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'بازگشت به پیشنهادها' })).toBeVisible()
  expect(p.onAcceptAlternative).not.toHaveBeenCalled()
})

it('never resolves an alternative through the original-only explanation lookup', () => {
  const { p, entry } = scenario()
  window.history.replaceState(null, '', offerHash('explanation', entry.key))
  render(<RecommendationPanel {...p} />)
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  navigate(offerHash('alternative', entry.key))
  expect(screen.getByRole('article')).toBeVisible()
})
