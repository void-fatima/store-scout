import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { RecommendationPanelProps } from '../contracts'
import { createJourneyClient } from '../api/journey'
import { isShoppingRequest } from '../api/validation'
import { acceptedJourneyFixture, journeyFixture } from '../test/fixtures/contracts'
import { associatedFixture } from '../test/journey-fixtures'
import { JourneyFlow } from './JourneyFlow'
import { responseEntries } from './operations'

/** Only a contract consumer for testing; never included in the production shell. */
function PanelProbe(props: RecommendationPanelProps) {
  const [accepted, setAccepted] = useState(false)
  const entry = props.response && responseEntries(props.response)[0]
  const suggestion = props.response?.suggestions[0]
  return <>
    <output aria-label="تعداد انتخاب‌ها">{props.comparison.length}</output>
    <button disabled={!entry} onClick={() => entry && props.onComparisonChange([entry.key])}>انتخاب مقایسه در تست</button>
    <button disabled={!entry?.plan} onClick={() => entry?.plan && props.onViewVerification(entry.key, entry.plan)}>برنامه در تست</button>
    <button onClick={() => props.onRetry(props.requestId, props.revision)}>تکرار در تست</button>
    <pre aria-label="تغییرهای تست">{JSON.stringify(suggestion?.changes)}</pre>
    <label><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} />پذیرش همهٔ تغییرها در تست</label>
    <button disabled={!accepted || !entry || !suggestion} onClick={() => {
      if (accepted && entry && suggestion) props.onAcceptAlternative({
        request_id: props.requestId, expected_revision: props.revision, dataset_id: entry.key.dataset_id,
        offer_id: suggestion.result.offer_id, accepted_changes: suggestion.changes,
      })
    }}>پذیرش در تست</button>
  </>
}

it('wires the Persian form, mocked HTTP and all four unchanged panel callbacks', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    const data: unknown = JSON.parse(String(init?.body))
    if (!isShoppingRequest(data)) throw new Error('Expected canonical request')
    const source = fetcher.mock.calls.length > 2 ? acceptedJourneyFixture : journeyFixture
    return new Response(JSON.stringify(associatedFixture(data, source)))
  })
  const user = userEvent.setup()
  render(<JourneyFlow Panel={PanelProbe} client={createJourneyClient({ fetcher })} />)
  await user.type(screen.getByLabelText('نام کالا'), 'گوشی')
  await user.type(screen.getByLabelText('حداکثر بودجه'), '۱۷۰۰۰۰۰۰٫۱۲۳۴۵۶۷۸۹')
  await user.selectOptions(screen.getByLabelText('واحد بودجه'), 'TOMAN')
  await user.type(screen.getByLabelText('عرض جغرافیایی محل انتخابی'), '۳۵٫۷')
  await user.type(screen.getByLabelText('طول جغرافیایی محل انتخابی'), '۵۱٫۴')
  await user.click(screen.getByRole('button', { name: 'دیدن پیشنهادها' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'انتخاب مقایسه در تست' })).toBeEnabled())
  expect(fetcher.mock.calls[0]?.[1]?.body).toContain('"max_budget":"17000000.123456789"')
  await user.click(screen.getByRole('button', { name: 'انتخاب مقایسه در تست' }))
  expect(screen.getByLabelText('تعداد انتخاب‌ها')).toHaveTextContent('1')
  await user.click(screen.getByRole('button', { name: 'برنامه در تست' }))
  expect(screen.getByText('برنامهٔ پیش از مراجعه انتخاب شد؛ موجودی هنوز تأیید نشده است.')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'تکرار در تست' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(screen.getByLabelText('تعداد انتخاب‌ها')).toHaveTextContent('0')
  await user.click(screen.getByRole('checkbox', { name: 'پذیرش همهٔ تغییرها در تست' }))
  await user.click(screen.getByRole('button', { name: 'پذیرش در تست' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
  expect(screen.getByLabelText('حداکثر بودجه')).toHaveValue(acceptedJourneyFixture.result.original_constraints.max_budget)
  expect(screen.queryByText('برنامهٔ پیش از مراجعه انتخاب شد؛ موجودی هنوز تأیید نشده است.')).not.toBeInTheDocument()
})

it('keeps an unmounted panel boundary clear without substituting fixture results', () => {
  const client = createJourneyClient({ fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response('trace', { status: 404 })) })
  // The form has no silent default coordinates or money; the empty mount remains reserved.
  render(<JourneyFlow client={client} />)
  expect(document.getElementById('recommendation-root')).toBeEmptyDOMElement()
  expect(screen.queryByText(/sample_offer/)).not.toBeInTheDocument()
})
