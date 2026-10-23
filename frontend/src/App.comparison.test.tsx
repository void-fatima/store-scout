import { useState } from 'react'
import type { ComponentProps } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { RecommendationPanelProps } from './contracts'
import { isShoppingRequest } from './api/validation'
import { errorFixture } from './test/fixtures/contracts'
import { associatedFixture } from './test/journey-fixtures'
import { responseEntries } from './journey/operations'
import App from './App'

/** Inject only a test consumer via the existing Panel prop; production stays empty. */
function SelectionProbe(props: RecommendationPanelProps) {
  const [mountId] = useState(() => crypto.randomUUID())
  const entries = props.response ? responseEntries(props.response) : []
  return <>
    <output aria-label="نشانهٔ نصب تست">{mountId}</output>
    <output aria-label="شناسه و نسخهٔ تست">{props.requestId}:{props.revision}</output>
    <output aria-label="تعداد انتخاب تست">{props.comparison.length}</output>
    <button disabled={!entries.length} onClick={() => props.onComparisonChange(entries.filter((_entry, index) => index === 0 || index === entries.length - 1).map(entry => entry.key))}>انتخاب برای مقایسه در تست</button>
    <button onClick={() => props.onRetry(props.requestId, props.revision)}>جست‌وجوی تازه در تست</button>
  </>
}

vi.mock('./journey', async importOriginal => {
  const actual = await importOriginal<typeof import('./journey')>()
  return { ...actual, JourneyFlow: (props: ComponentProps<typeof actual.JourneyFlow>) => <actual.JourneyFlow {...props} Panel={SelectionProbe} /> }
})

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
function fetchSuccess() {
  return vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
    const request: unknown = JSON.parse(String(init?.body))
    if (!isShoppingRequest(request)) throw new Error('Expected canonical request')
    return json(associatedFixture(request))
  })
}
async function searchAndSelect(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('نام کالا'), 'گوشی')
  await user.type(screen.getByLabelText('حداکثر بودجه'), '۱۷۰۰۰۰۰۰٫۱۲۳۴۵۶۷۸۹')
  await user.selectOptions(screen.getByLabelText('واحد بودجه'), 'TOMAN')
  await user.type(screen.getByLabelText('عرض جغرافیایی محل انتخابی'), '۳۵٫۷')
  await user.type(screen.getByLabelText('طول جغرافیایی محل انتخابی'), '۵۱٫۴')
  await user.click(screen.getByRole('button', { name: 'دیدن پیشنهادها' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'انتخاب برای مقایسه در تست' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'انتخاب برای مقایسه در تست' }))
}
async function compare(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(screen.getByRole('navigation', { name: 'ناوبری اصلی' })).getByRole('link', { name: /^مقایسه / }))
  await waitFor(() => expect(screen.getByRole('region', { name: 'مقایسهٔ خرید' })).toBeVisible())
}

beforeEach(() => { window.history.replaceState(null, '', '/') })
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

it('navigates without remounting or losing the draft, request, results or controller selections', async () => {
  const fetcher = fetchSuccess()
  vi.stubGlobal('fetch', fetcher)
  const user = userEvent.setup()
  render(<App />)
  await searchAndSelect(user)
  expect(screen.getByRole('link', { name: 'مقایسه ۲ انتخاب' })).toBeInTheDocument()
  const form = screen.getByRole('form', { name: 'معیارهای خرید' })
  const mountId = screen.getByLabelText('نشانهٔ نصب تست').textContent
  const identity = screen.getByLabelText('شناسه و نسخهٔ تست').textContent
  await compare(user)
  expect(screen.getByRole('region', { name: 'مقایسهٔ خرید' })).toHaveFocus()
  expect(form).not.toBeVisible()
  expect(screen.getByRole('link', { name: /^مقایسه / })).toHaveAttribute('aria-current', 'page')
  expect(screen.getAllByRole('columnheader')).toHaveLength(3)
  const firstRemove = screen.getAllByRole('button', { name: /^حذف / })[0]
  if (!firstRemove) throw new Error('Expected comparison removal control')
  await user.click(firstRemove)
  await waitFor(() => expect(screen.getByRole('button', { name: /^حذف / })).toHaveFocus())
  expect(screen.getByText(/یک آفر انتخاب شده است/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'مقایسه ۱ انتخاب' })).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'بازگشت به جست‌وجو' }))
  await waitFor(() => expect(form).toBeVisible())
  expect(screen.getByRole('region', { name: 'جست‌وجوی خرید' })).toHaveFocus()
  expect(screen.getByLabelText('حداکثر بودجه')).toHaveValue('۱۷۰۰۰۰۰۰٫۱۲۳۴۵۶۷۸۹')
  expect(screen.getByLabelText('نام کالا')).toHaveValue('گوشی')
  expect(screen.getByLabelText('نشانهٔ نصب تست')).toHaveTextContent(mountId!)
  expect(screen.getByLabelText('شناسه و نسخهٔ تست')).toHaveTextContent(identity!)
  expect(screen.getByLabelText('تعداد انتخاب تست')).toHaveTextContent('1')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('immediately removes comparison data after criteria edits without issuing an implicit request', async () => {
  const fetcher = fetchSuccess()
  vi.stubGlobal('fetch', fetcher)
  const user = userEvent.setup()
  render(<App />)
  await searchAndSelect(user)
  await compare(user)
  expect(screen.getByRole('table')).toBeVisible()
  await user.click(screen.getByRole('link', { name: 'بازگشت به جست‌وجو' }))
  await waitFor(() => expect(screen.getByLabelText('نام کالا')).toBeVisible())
  await user.type(screen.getByLabelText('نام کالا'), ' جدید')
  expect(screen.getByRole('link', { name: 'مقایسه ۰ انتخاب' })).toBeInTheDocument()
  await compare(user)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByText(/با تغییر معیارها یا داده‌ها/)).toBeVisible()
  expect(screen.getByLabelText('تعداد انتخاب تست')).toHaveTextContent('0')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('opens useful guidance from comparison without losing current criteria or issuing another request', async () => {
  const fetcher = fetchSuccess()
  vi.stubGlobal('fetch', fetcher)
  const user = userEvent.setup()
  render(<App />)
  await searchAndSelect(user)
  await compare(user)
  await user.click(screen.getByRole('link', { name: 'راهنمای خرید' }))
  await waitFor(() => expect(screen.getByRole('region', { name: 'راهنمای خرید' })).toHaveFocus())
  expect(screen.getByLabelText('نام کالا')).toHaveValue('گوشی')
  expect(screen.getByRole('heading', { name: 'نیازت را مشخص کن' })).toBeVisible()
  expect(screen.getByRole('link', { name: 'مقایسه ۲ انتخاب' })).toBeInTheDocument()
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('does not show old columns during a fresh search or after a snapshot conflict', async () => {
  const fetcher = fetchSuccess()
  let resolve!: (value: Response) => void
  const pending = new Promise<Response>(done => { resolve = done })
  vi.stubGlobal('fetch', fetcher)
  const user = userEvent.setup()
  render(<App />)
  await searchAndSelect(user)
  fetcher.mockReturnValueOnce(pending)
  await user.click(screen.getByRole('button', { name: 'جست‌وجوی تازه در تست' }))
  await compare(user)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByText(/جست‌وجوی تازه در حال انجام است/)).toBeVisible()
  await act(async () => resolve(json(errorFixture, 409)))
  await waitFor(() => expect(screen.getByText(/نتیجهٔ معتبری برای مقایسه در دسترس نیست/)).toBeVisible())
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'بازگشت به جست‌وجو' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('داده‌های فروشگاه‌ها تغییر کرده‌اند'))
  expect(screen.getByLabelText('حداکثر بودجه')).toHaveValue('۱۷۰۰۰۰۰۰٫۱۲۳۴۵۶۷۸۹')
})

it('supports a direct comparison link, keyboard navigation and removal down to zero', async () => {
  window.history.replaceState(null, '', '/#comparison')
  vi.stubGlobal('fetch', fetchSuccess())
  const user = userEvent.setup()
  render(<App />)
  expect(screen.getByText(/هنوز انتخاب معتبری برای مقایسه ندارید/)).toBeVisible()
  const searchLink = screen.getByRole('link', { name: 'پیشنهادها' })
  searchLink.focus()
  await user.keyboard('{Enter}')
  await waitFor(() => expect(screen.getByLabelText('نام کالا')).toBeVisible())
  await searchAndSelect(user)
  await compare(user)
  await user.click(screen.getAllByRole('button', { name: /^حذف / })[0]!)
  await user.click(screen.getByRole('button', { name: /^حذف / }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'مقایسهٔ انتخاب‌ها' })).toHaveFocus())
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByText(/هنوز انتخاب معتبری برای مقایسه ندارید/)).toBeVisible()
})
