import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { RecommendationPanelProps } from '../../contracts'
import { acceptedJourneyFixture, journeyFixture } from '../../test/fixtures/contracts'
import { responseEntries } from '../../journey/operations'
import { RecommendationPanel } from './RecommendationPanel'
import { VerificationContext } from './VerificationContext'
import { offerHash } from './presentation'

afterEach(() => { window.history.replaceState(null, '', '/') })
function scenario(alternative = false) {
  const response = structuredClone((alternative ? journeyFixture : acceptedJourneyFixture).result)
  const entry = responseEntries(response)[0]!
  const p: RecommendationPanelProps = { response, requestId: 'checklist-ui', revision: 7, comparison: [], status: 'ready', error: null,
    onComparisonChange: vi.fn(), onViewVerification: vi.fn(), onAcceptAlternative: vi.fn(), onRetry: vi.fn() }
  window.history.replaceState(null, '', offerHash('checklist', entry.key))
  return { p, entry }
}

it('selects the owning canonical plan and keeps personal reminders separate from all pending states', async () => {
  const { p, entry } = scenario()
  const originalPlan = structuredClone(entry.plan!)
  render(<RecommendationPanel {...p} />)
  expect(p.onViewVerification).toHaveBeenCalledExactlyOnceWith(entry.key, entry.plan)
  for (const item of entry.plan!.checklist) expect(screen.getByText(item.question, { exact: true })).toBeVisible()
  const reminders = screen.getAllByRole('checkbox', { name: /^یادآوری شخصی:/ })
  await userEvent.click(reminders[0]!)
  expect(reminders[0]).toBeChecked()
  expect(screen.getAllByText('در انتظار بررسی', { exact: true })).toHaveLength(entry.plan!.checklist.length)
  expect(screen.getByText(/تماسی با فروشنده انجام نشده است/)).toBeVisible()
  expect(entry.plan).toEqual(originalPlan)
  expect(entry.plan?.contact_attempted).toBe(false)
  expect(screen.queryByRole('link', { name: /تماس|مسیریابی/ })).not.toBeInTheDocument()
  expect(p.onAcceptAlternative).not.toHaveBeenCalled()
})

it('uses only the current controller-selected plan when the provider is present', () => {
  const { p, entry } = scenario()
  const view = render(<VerificationContext value={null}><RecommendationPanel {...p} /></VerificationContext>)
  expect(screen.queryByRole('checkbox', { name: /^یادآوری شخصی:/ })).not.toBeInTheDocument()
  view.rerender(<VerificationContext value={{ key: entry.key, plan: entry.plan! }}><RecommendationPanel {...p} /></VerificationContext>)
  expect(screen.getByRole('heading', { name: 'چک‌لیست پیش از مراجعه' })).toHaveFocus()
  expect(screen.getAllByRole('checkbox', { name: /^یادآوری شخصی:/ })).toHaveLength(entry.plan!.checklist.length)
  view.rerender(<VerificationContext value={{ key: { ...entry.key, offer_id: 'wrong-offer' }, plan: entry.plan! }}><RecommendationPanel {...p} /></VerificationContext>)
  expect(screen.queryByRole('checkbox', { name: /^یادآوری شخصی:/ })).not.toBeInTheDocument()
  expect(p.onViewVerification).toHaveBeenCalledTimes(1)
})

it('resets reminders on revision or snapshot changes, and removes plans on dataset invalidation', async () => {
  const { p } = scenario()
  const view = render(<RecommendationPanel {...p} />)
  await userEvent.click(screen.getAllByRole('checkbox', { name: /^یادآوری شخصی:/ })[0]!)
  view.rerender(<RecommendationPanel {...p} revision={8} />)
  expect(screen.getAllByRole('checkbox', { name: /^یادآوری شخصی:/ })[0]).not.toBeChecked()
  await userEvent.click(screen.getAllByRole('checkbox', { name: /^یادآوری شخصی:/ })[0]!)
  const replacement = structuredClone(p.response)!
  view.rerender(<RecommendationPanel {...p} response={replacement} revision={8} />)
  expect(screen.getAllByRole('checkbox', { name: /^یادآوری شخصی:/ })[0]).not.toBeChecked()
  replacement.original.context.dataset!.dataset_id = 'replaced'
  view.rerender(<RecommendationPanel {...p} response={replacement} revision={9} />)
  expect(screen.queryByRole('checkbox', { name: /^یادآوری شخصی:/ })).not.toBeInTheDocument()
  expect(screen.getByText('این پیشنهاد در نتیجهٔ فعلی در دسترس نیست')).toBeVisible()
})

it('handles missing plans, stale links and loading without showing old questions', () => {
  const { p, entry } = scenario()
  p.response!.original_verification = []
  const view = render(<RecommendationPanel {...p} />)
  expect(screen.getByText('برنامهٔ بررسی برای این آفر در دسترس نیست')).toBeVisible()
  expect(p.onViewVerification).not.toHaveBeenCalled()
  act(() => { window.location.hash = offerHash('checklist', { ...entry.key, product_id: 'missing' }); window.dispatchEvent(new HashChangeEvent('hashchange')) })
  expect(screen.getByRole('link', { name: 'بازگشت به پیشنهادها' })).toBeVisible()
  view.rerender(<RecommendationPanel {...p} status="loading" />)
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})

it('opens an alternative plan without accepting its criteria and exposes its own warnings', async () => {
  const { p, entry } = scenario(true)
  render(<RecommendationPanel {...p} />)
  expect(p.onViewVerification).toHaveBeenCalledWith(entry.key, entry.plan)
  expect(screen.getByRole('link', { name: 'بازگشت به جایگزین' })).toHaveAttribute('href', offerHash('alternative', entry.key))
  await userEvent.click(screen.getByText('شناسه‌ها و هشدارهای برنامه'))
  const details = screen.getByText('شناسه‌ها و هشدارهای برنامه').parentElement!
  for (const warning of entry.plan!.warnings) expect(within(details).getByText(warning)).toBeVisible()
  expect(p.onAcceptAlternative).not.toHaveBeenCalled()
})
