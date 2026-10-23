import { act, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { RecommendationPanelProps } from '../../contracts'
import { acceptedJourneyFixture, journeyFixture } from '../../test/fixtures/contracts'
import { responseEntries } from '../../journey/operations'
import { RecommendationPanel } from './RecommendationPanel'
import { VerificationContext } from './VerificationContext'
import { offerHash, productHash } from './presentation'

afterEach(() => { window.history.replaceState(null, '', '/') })

it.each(['purchase', 'checklist'] as const)('mounts the current original/alternative location in %s and removes it on invalidation', viewName => {
  for (const fixture of [acceptedJourneyFixture, journeyFixture]) {
    const response = structuredClone(fixture.result)
    const entry = responseEntries(response)[0]!
    const props: RecommendationPanelProps = {
      requestId: 'location-integration', revision: 3, status: 'ready', response, comparison: [], error: null,
      onComparisonChange: vi.fn(), onViewVerification: vi.fn(), onAcceptAlternative: vi.fn(), onRetry: vi.fn(),
    }
    const hash = viewName === 'purchase' ? productHash(entry.key, 'purchase') : offerHash('checklist', entry.key)
    window.history.replaceState(null, '', hash)
    const view = render(<VerificationContext value={null}><RecommendationPanel {...props} /></VerificationContext>)
    expect(screen.queryByRole('heading', { name: 'مکان ثبت‌شدهٔ فروشگاه' })).not.toBeInTheDocument()
    view.rerender(<VerificationContext value={{ key: entry.key, plan: entry.plan! }}><RecommendationPanel {...props} /></VerificationContext>)
    const location = screen.getByRole('region', { name: 'مکان ثبت‌شدهٔ فروشگاه' })
    const shop = entry.result.candidate.shop
    expect(within(location).getByText(shop.address!, { exact: true })).toBeVisible()
    expect(within(location).getByTitle(/نقشهٔ تعاملی/)).toHaveAttribute('src', expect.stringContaining(`marker=${shop.lat}%2C${shop.lon}`))
    expect(within(location).getByText('نشانی ثبت‌شده', { exact: true })).toBeVisible()
    expect(screen.queryByText('مختصات', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText('نشانی', { exact: true })).not.toBeInTheDocument()
    act(() => { within(location).getByText('منبع و محدودیت‌های مکان').click() })
    expect(within(location).getByText(response.original.context.dataset!.dataset_id, { exact: true })).toBeVisible()
    view.rerender(<RecommendationPanel {...props} status="loading" />)
    expect(screen.queryByTitle(/نقشهٔ تعاملی/)).not.toBeInTheDocument()
    expect(props.onAcceptAlternative).not.toHaveBeenCalled()
    view.unmount()
  }
})

it('does not mount a location for a missing or mismatched owning plan', () => {
  const response = structuredClone(acceptedJourneyFixture.result)
  const entry = responseEntries(response)[0]!
  const props: RecommendationPanelProps = {
    requestId: 'location-guard', revision: 0, status: 'ready', response, comparison: [], error: null,
    onComparisonChange: vi.fn(), onViewVerification: vi.fn(), onAcceptAlternative: vi.fn(), onRetry: vi.fn(),
  }
  entry.plan!.shop_id = 'unrelated-shop'
  window.history.replaceState(null, '', offerHash('checklist', entry.key))
  render(<RecommendationPanel {...props} />)
  expect(screen.queryByTitle(/نقشهٔ تعاملی/)).not.toBeInTheDocument()
  expect(props.onViewVerification).not.toHaveBeenCalled()
})
