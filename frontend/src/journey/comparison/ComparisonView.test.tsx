import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { AlternativesResponse } from '../../contracts'
import { alternativesFixture } from '../../test/fixtures/contracts'
import { responseEntries } from '../operations'
import { ComparisonView } from './ComparisonView'
import { offerHash } from '../../features/recommendation/presentation'

const renderComparison = (response: AlternativesResponse = alternativesFixture) => {
  const entries = responseEntries(response)
  const change = vi.fn()
  const view = render(<ComparisonView response={response} selections={entries.map(entry => entry.key)} status="ready" onComparisonChange={change} />)
  return { ...view, entries, change }
}

it('matches the full dataset/product/offer identity despite identical product titles', () => {
  const { entries } = renderComparison()
  const table = screen.getByRole('table')
  expect(entries).toHaveLength(3)
  expect(new Set(entries.map(entry => entry.result.candidate.product.persian_title)).size).toBe(1)
  const identityRow = within(table).getByRole('row', { name: /^شناسهٔ کالا/ })
  const cells = within(identityRow).getAllByRole('cell')
  expect(cells.map(cell => cell.textContent)).toEqual(entries.map(entry => entry.key.product_id))
  const columns = within(table).getAllByRole('columnheader').slice(1)
  expect(columns.map(column => column.textContent)).toEqual(entries.map(entry => expect.stringContaining(entry.key.offer_id)))
  expect(within(table).getByRole('row', { name: /^قیمت ثبت‌شده/ })).toHaveTextContent('تومان')
})

it('delegates removal and keeps accessible control names distinct for same-title offers', async () => {
  const user = userEvent.setup()
  const { entries, change, rerender } = renderComparison()
  const second = entries[1]
  if (!second) throw new Error('Expected canonical second selection')
  await user.click(screen.getByRole('button', { name: `حذف ${second.result.candidate.product.persian_title}، آفر ${second.key.offer_id} از مقایسه` }))
  const remaining = entries.filter(entry => entry !== second).map(entry => entry.key)
  expect(change).toHaveBeenCalledExactlyOnceWith(remaining)
  // This is a controlled view; only the owner's next selection state removes a column.
  rerender(<ComparisonView response={alternativesFixture} selections={remaining} status="ready" onComparisonChange={change} />)
  expect(screen.getAllByRole('button', { name: /^حذف / })).toHaveLength(2)
})

it('explicitly displays unknown recorded values, without treating zero as missing', () => {
  const response = structuredClone(alternativesFixture)
  const first = response.suggestions[0]
  if (!first) throw new Error('Expected canonical suggestion')
  const offer = first.result.candidate
  offer.price_toman = null
  offer.shop.lat = null
  offer.shop.lon = null
  offer.shop.weekly_hours = { sat: { unexpected: true } }
  offer.shop.payment_options = [{ unsupported: 'not a payment declaration' }]
  offer.warranty = null
  offer.distance_km = 0
  render(<ComparisonView response={response} selections={responseEntries(response).slice(0, 1).map(entry => entry.key)} status="ready" onComparisonChange={vi.fn()} />)
  const table = screen.getByRole('table')
  for (const label of ['قیمت ثبت‌شده', 'مختصات فروشگاه', 'ساعات کاری ثبت‌شده', 'روش‌های پرداخت ثبت‌شده', 'گارانتی ثبت‌شده', 'شرایط بازگشت کالا']) {
    expect(within(table).getByRole('row', { name: new RegExp(`^${label}`) })).toHaveTextContent('نامشخص')
  }
  expect(within(table).getByRole('row', { name: /^فاصلهٔ مستقیم/ })).toHaveTextContent('۰ کیلومتر (مستقیم)')
  expect(screen.getByText(/یک آفر انتخاب شده است/)).toBeVisible()
})

it('preserves recorded hours, purchase declarations and synthetic provenance without verification claims', () => {
  renderComparison()
  const table = screen.getByRole('table')
  expect(within(table).getByRole('row', { name: /^ساعات کاری ثبت‌شده/ })).toHaveTextContent('09:00:00 تا 18:00:00')
  expect(within(table).getByRole('row', { name: /^روش‌های پرداخت ثبت‌شده/ })).toHaveTextContent('ثبت‌شده و تأییدنشده')
  expect(within(table).getByRole('row', { name: /^موجودی/ })).toHaveTextContent('تأییدنشده')
  expect(within(table).getByRole('row', { name: /^نوع نتیجه/ })).toHaveTextContent('نیازمند پذیرش تغییرهاست')
  expect(screen.getByRole('complementary', { name: 'محدودیت‌های اطلاعات' })).toHaveTextContent('اطلاعات تماس ساختگی')
  expect(screen.getByText('منبع این مقایسه، دادهٔ نمونه و ساختگی است.')).toBeVisible()
  expect(screen.getByText(alternativesFixture.original.context.dataset!.dataset_id)).toBeVisible()
  expect(screen.getByRole('region', { name: 'جدول مقایسهٔ آفرها' })).toHaveAttribute('tabindex', '0')
})

it('fails closed for stale/missing identities and never carries offers across snapshot changes', () => {
  const selected = responseEntries(alternativesFixture).map(entry => entry.key)
  const change = vi.fn()
  const { rerender } = render(<ComparisonView response={alternativesFixture} selections={[{ ...selected[0]!, product_id: 'missing-product' }]} status="ready" onComparisonChange={change} />)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByText(/بعضی انتخاب‌ها در داده‌های فعلی پیدا نشدند/)).toBeVisible()
  const replacement = structuredClone(alternativesFixture)
  if (!replacement.original.context.dataset) throw new Error('Expected dataset')
  replacement.original.context.dataset.dataset_id = 'new-dataset'
  rerender(<ComparisonView response={replacement} selections={selected} status="ready" onComparisonChange={change} />)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  for (const status of ['idle', 'loading', 'error'] as const) {
    rerender(<ComparisonView response={alternativesFixture} selections={selected} status={status} onComparisonChange={change} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  }
})

it('explains zero selections without hiding the return path', () => {
  render(<ComparisonView response={null} selections={[]} status="idle" onComparisonChange={vi.fn()} />)
  expect(screen.getByText(/هنوز انتخاب معتبری برای مقایسه ندارید/)).toBeVisible()
  expect(screen.getByRole('link', { name: 'بازگشت به جست‌وجو' })).toHaveAttribute('href', '#search')
})

it('links each current identity to its owning checklist and review without accepting alternatives', () => {
  const { entries } = renderComparison()
  expect(screen.getAllByRole('link', { name: 'چک‌لیست پیش از مراجعه' }).map(link => link.getAttribute('href')))
    .toEqual(entries.map(entry => offerHash('checklist', entry.key)))
  expect(screen.getAllByRole('link', { name: 'دیدن تغییرهای پیشنهادی' }).map(link => link.getAttribute('href')))
    .toEqual(entries.map(entry => offerHash('alternative', entry.key)))
  expect(screen.getByRole('link', { name: 'بازگشت به پیشنهادها' })).toHaveAttribute('href', '#results')
})

it('displays recorded monetary digits without extra fractional rounding and keeps source warnings available', async () => {
  const response = structuredClone(alternativesFixture)
  response.suggestions[0]!.result.candidate.price_toman = 19000000.1234567
  renderComparison(response)
  expect(screen.getByRole('row', { name: /^قیمت ثبت‌شده/ })).toHaveTextContent('۱۹٬۰۰۰٬۰۰۰٫۱۲۳۴۵۶۷ تومان')
  await userEvent.click(screen.getByText('هشدارها و محدودیت‌های منبع'))
  for (const warning of response.warnings) expect(screen.getByText(warning)).toBeVisible()
})
