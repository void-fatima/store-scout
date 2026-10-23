import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { IntentEditor } from './IntentEditor'

it.each([['', '0'], ['91', '0'], ['0', '-181'], ['Infinity', '0']])('rejects invalid or partial coordinates %s/%s without sending', async (lat, lon) => {
  const submit = vi.fn()
  render(<IntentEditor fields={{}} disabled={false} onEdit={vi.fn()} onSubmit={submit} />)
  fireEvent.change(screen.getByLabelText('عرض مرکز جست‌وجوی من'), { target: { value: lat } })
  fireEvent.change(screen.getByLabelText('طول مرکز جست‌وجوی من'), { target: { value: lon } })
  await userEvent.click(screen.getByRole('button', { name: 'ثبت اصلاح معیارها' }))
  expect(screen.getByRole('alert')).toHaveTextContent('هر دو مختصات را معتبر وارد کن')
  expect(submit).not.toHaveBeenCalled()
})

it('sends zero only after explicit coordinate review and binds it to the retained location label', async () => {
  const submit = vi.fn()
  render(<IntentEditor fields={{ location: 'محدودهٔ انتخابی' }} disabled={false} onEdit={vi.fn()} onSubmit={submit} />)
  fireEvent.change(screen.getByLabelText('عرض مرکز جست‌وجوی من'), { target: { value: '۰' } })
  fireEvent.change(screen.getByLabelText('طول مرکز جست‌وجوی من'), { target: { value: '٠' } })
  await userEvent.click(screen.getByRole('button', { name: 'ثبت اصلاح معیارها' }))
  expect(submit).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('تأیید کن')
  await userEvent.click(screen.getByRole('checkbox'))
  await userEvent.click(screen.getByRole('button', { name: 'ثبت اصلاح معیارها' }))
  expect(submit).toHaveBeenCalledExactlyOnceWith({ coordinates: { latitude: 0, longitude: 0, for_location: 'محدودهٔ انتخابی' } })
})

it('keeps user edits and sends only selected fields, including explicit removal of coordinates', async () => {
  const submit = vi.fn()
  render(<IntentEditor fields={{ product_query: 'گوشی', coordinates: { latitude: 35.7, longitude: 51.4 }, radius: '۵ کیلومتر' }} disabled={false} onEdit={vi.fn()} onSubmit={submit} />)
  fireEvent.change(screen.getByLabelText('عرض مرکز جست‌وجوی من'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('طول مرکز جست‌وجوی من'), { target: { value: '' } })
  await userEvent.click(screen.getByRole('button', { name: 'ثبت اصلاح معیارها' }))
  expect(submit).toHaveBeenCalledExactlyOnceWith({ coordinates: null })
  expect(screen.getByLabelText('شعاع جست‌وجو با واحد')).toHaveValue('۵ کیلومتر')
})
