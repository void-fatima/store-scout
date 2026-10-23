import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { acceptedJourneyFixture, journeyFixture } from '../../test/fixtures/contracts'
import { responseEntries } from '../../journey/operations'
import { ProductFit } from './ProductFit'
import { offerHash } from './presentation'

it('shows submitted original criteria, exact budget and owning backend messages without a new score', () => {
  const response = structuredClone(acceptedJourneyFixture.result)
  response.original_constraints.max_budget = '19000000.123456789'
  response.original_constraints.preferred_purchase_conditions = { payment_methods: ['card'], warranty_available: false, return_window_days: 0 }
  const entry = responseEntries(response)[0]!
  render(<ProductFit entry={entry} response={response} />)
  expect(screen.getByText('معیارهای ارسال‌شدهٔ این جست‌وجو')).toBeVisible()
  expect(screen.getByText('۱۹٬۰۰۰٬۰۰۰٫۱۲۳۴۵۶۷۸۹ تومان')).toBeVisible()
  expect(screen.getByText('بدون گارانتی')).toBeVisible()
  expect(screen.getByText('۰ روز')).toBeVisible()
  expect(screen.getByText('کارت')).toBeVisible()
  for (const reason of entry.result.explanation_reasons) expect(screen.getByText(reason.message)).toBeVisible()
  for (const limitation of entry.result.data_limitations) expect(screen.getByText(limitation.message)).toBeVisible()
  expect(screen.getByText(/اطلاعات کافی برای ارزیابی فنی/)).toBeVisible()
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})

it('uses the owning alternative proposed criteria, separates the original, and links to explicit review', () => {
  const response = structuredClone(journeyFixture.result)
  const entry = responseEntries(response)[0]!
  const suggestion = response.suggestions.find(item => item.result === entry.result)!
  suggestion.relaxed_constraints.query = 'معیار پیشنهادی اختصاصی'
  suggestion.relaxed_constraints.max_budget = '23456789.123456789'
  render(<ProductFit entry={entry} response={response} />)
  expect(screen.getByText(/این جایگزین با معیارهای پیشنهادی/)).toHaveTextContent('دیدن این بخش، پذیرش تغییرها نیست')
  expect(screen.getAllByText('معیار پیشنهادی اختصاصی')).toHaveLength(2)
  expect(screen.getAllByText('۲۳٬۴۵۶٬۷۸۹٫۱۲۳۴۵۶۷۸۹ تومان')).toHaveLength(2)
  expect(screen.getByText(suggestion.original_constraints.query)).toBeVisible()
  expect(screen.getByRole('link', { name: 'بررسی و پذیرش صریح تغییرهای جایگزین' })).toHaveAttribute('href', offerHash('alternative', entry.key))
  for (const reason of entry.result.explanation_reasons) expect(screen.getByText(reason.message)).toBeVisible()
})

it('never falls back to original criteria for a stale alternative', () => {
  const response = structuredClone(journeyFixture.result)
  const entry = responseEntries(response)[0]!
  const view = render(<ProductFit entry={entry} response={response} />)
  view.rerender(<ProductFit entry={entry} response={{ ...response, suggestions: [] }} />)
  expect(screen.getByRole('alert')).toHaveTextContent('معیار پیشنهادی این جایگزین در نتیجهٔ فعلی در دسترس نیست')
  expect(screen.queryByText('معیارهای ارسال‌شدهٔ این جست‌وجو')).not.toBeInTheDocument()
})
