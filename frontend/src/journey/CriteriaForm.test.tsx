import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { CriteriaForm } from './CriteriaForm'
import { emptyDraft, validateCriteria } from './criteria'
import type { FieldErrors } from './criteria'

it('exposes labels and mobile input modes, preserves invalid entries and submits explicit units', async () => {
  const submitted = vi.fn()
  function FormHarness() {
    const [draft, setDraft] = useState(emptyDraft)
    const [errors, setErrors] = useState<FieldErrors>({})
    return <CriteriaForm draft={draft} errors={errors} loading={false} onChange={setDraft} onSubmit={() => {
      const checked = validateCriteria(draft)
      if (checked.ok) submitted(checked.criteria)
      else setErrors(checked.errors)
    }} />
  }
  const user = userEvent.setup()
  render(<FormHarness />)
  expect(screen.getByLabelText('حداکثر بودجه')).toHaveAttribute('inputmode', 'decimal')
  expect(screen.getByLabelText('عرض جغرافیایی محل انتخابی')).toHaveValue('')
  await user.type(screen.getByLabelText('نام کالا'), 'گوشی')
  await user.type(screen.getByLabelText('حداکثر بودجه'), '۱۲۳٫۴۵۶۷۸۹')
  await user.click(screen.getByRole('button', { name: 'دیدن پیشنهادها' }))
  expect(submitted).not.toHaveBeenCalled()
  expect(screen.getByLabelText('حداکثر بودجه')).toHaveValue('۱۲۳٫۴۵۶۷۸۹')
  expect(screen.getByLabelText('واحد بودجه')).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText('واحد بودجه را انتخاب کنید.')).toBeVisible()
  await user.selectOptions(screen.getByLabelText('واحد بودجه'), 'IRR')
  await user.type(screen.getByLabelText('عرض جغرافیایی محل انتخابی'), '۳۵٫۷')
  await user.type(screen.getByLabelText('طول جغرافیایی محل انتخابی'), '۵۱٫۴')
  await user.click(screen.getByRole('button', { name: 'دیدن پیشنهادها' }))
  expect(submitted).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ max_budget: '123.456789', price_unit: 'IRR' }))
})

it('opens preferences and focuses associated asynchronous field errors without clearing input', async () => {
  const draft = { ...emptyDraft(), query: 'گوشی', returnDays: '۱٫۵' }
  const { rerender } = render(<CriteriaForm draft={draft} errors={{}} loading={false} onChange={() => {}} onSubmit={() => {}} />)
  rerender(<CriteriaForm draft={draft} errors={{ returnDays: 'تعداد روز را بررسی کنید.' }} loading={false} onChange={() => {}} onSubmit={() => {}} />)
  const field = screen.getByLabelText('مهلت بازگشت (روز، اختیاری)')
  await waitFor(() => expect(field).toHaveFocus())
  expect(field).toBeVisible()
  expect(field).toHaveAttribute('aria-describedby', 'error-returnDays')
  expect(field).toHaveValue('۱٫۵')
})
