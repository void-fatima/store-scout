import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ComparisonKey, RecommendationPanelProps } from '../contracts'
import { alternativesFixture, errorFixture } from './fixtures/contracts'

/** Test-only wiring consumer: no production recommendation UI lives here. */
function ContractConsumer(props: RecommendationPanelProps) {
  const [accepted, setAccepted] = useState(false)
  const suggestion = props.response?.suggestions[0]
  const dataset = props.response?.original.context.dataset
  const key: ComparisonKey | null = suggestion && dataset ? {
    dataset_id: dataset.dataset_id,
    product_id: suggestion.result.product_id,
    offer_id: suggestion.result.offer_id,
  } : null

  return <>
    <output aria-label="وضعیت">{props.status}</output>
    {props.error && <p role="alert">{props.error.error.message}</p>}
    <button onClick={() => props.onRetry(props.requestId, props.revision)}>تلاش دوباره</button>
    <button disabled={!key} onClick={() => {
      if (key) props.onComparisonChange([...props.comparison, key])
    }}>مقایسه</button>
    <button disabled={!key} onClick={() => {
      if (key && suggestion) props.onViewVerification(key, suggestion.verification)
    }}>نمایش برنامه</button>
    <pre aria-label="تغییرهای پیشنهادی">{JSON.stringify(suggestion?.changes)}</pre>
    <label><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} />
      همهٔ تغییرهای نمایش‌داده‌شده را می‌پذیرم
    </label>
    <button disabled={!key || !accepted} onClick={() => {
      if (key && suggestion && accepted) props.onAcceptAlternative({
        request_id: props.requestId,
        expected_revision: props.revision,
        dataset_id: key.dataset_id,
        offer_id: key.offer_id,
        accepted_changes: suggestion.changes,
      })
    }}>پذیرش صریح</button>
  </>
}

function makeProps(): RecommendationPanelProps {
  return {
    requestId: 'consumer-request', revision: 7,
    response: alternativesFixture, comparison: [], status: 'ready', error: null,
    onComparisonChange: vi.fn(), onViewVerification: vi.fn(),
    onRetry: vi.fn(), onAcceptAlternative: vi.fn(),
  }
}

describe('the shared controlled panel boundary', () => {
  it('passes dataset/product/offer identity and the original verification plan', async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<ContractConsumer {...props} />)
    const suggestion = alternativesFixture.suggestions[0]
    const dataset = alternativesFixture.original.context.dataset
    if (!suggestion || !dataset) throw new Error('Canonical fixture needs an alternative and dataset')
    const key: ComparisonKey = {
      dataset_id: dataset.dataset_id,
      product_id: suggestion.result.product_id,
      offer_id: suggestion.result.offer_id,
    }
    await user.click(screen.getByRole('button', { name: 'مقایسه' }))
    expect(props.onComparisonChange).toHaveBeenCalledExactlyOnceWith([key])
    await user.click(screen.getByRole('button', { name: 'نمایش برنامه' }))
    expect(props.onViewVerification).toHaveBeenCalledExactlyOnceWith(key, suggestion.verification)
    expect(suggestion.verification.contact_attempted).toBe(false)
  })

  it('emits all disclosed changes only after an explicit acceptance interaction', async () => {
    const props = makeProps()
    const user = userEvent.setup()
    render(<ContractConsumer {...props} />)
    expect(screen.getByLabelText('تغییرهای پیشنهادی'))
      .toHaveTextContent(JSON.stringify(alternativesFixture.suggestions[0]?.changes))
    const accept = screen.getByRole('button', { name: 'پذیرش صریح' })
    expect(accept).toBeDisabled()
    await user.click(accept)
    expect(props.onAcceptAlternative).not.toHaveBeenCalled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(accept)
    const suggestion = alternativesFixture.suggestions[0]
    expect(props.onAcceptAlternative).toHaveBeenCalledExactlyOnceWith({
      request_id: props.requestId, expected_revision: props.revision,
      dataset_id: alternativesFixture.original.context.dataset?.dataset_id,
      offer_id: suggestion?.result.offer_id, accepted_changes: suggestion?.changes,
    })
  })

  it('carries current identity/revision on retry and supports null/error states', async () => {
    const props = makeProps()
    const user = userEvent.setup()
    const { rerender } = render(<ContractConsumer {...props} response={null} status="loading" />)
    expect(screen.getByLabelText('وضعیت')).toHaveTextContent('loading')
    expect(screen.getByRole('button', { name: 'مقایسه' })).toBeDisabled()
    rerender(<ContractConsumer {...props} requestId="next-request" revision={8}
      response={null} status="error" error={errorFixture} />)
    expect(screen.getByRole('alert')).toHaveTextContent(errorFixture.error.message)
    await user.click(screen.getByRole('button', { name: 'تلاش دوباره' }))
    expect(props.onRetry).toHaveBeenCalledExactlyOnceWith('next-request', 8)
    expect(props.onAcceptAlternative).not.toHaveBeenCalled()
  })
})
