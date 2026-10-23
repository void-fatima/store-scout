import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { IntentEditor } from './IntentEditor'
import { validPoint } from './locationPoint'

const maps = vi.hoisted(() => ({ instances: [] as { click: ((event: unknown) => void) | undefined; remove: ReturnType<typeof vi.fn>; invalidateSize: ReturnType<typeof vi.fn> }[], fail: false,
  marker: vi.fn(), tileEvents: {} as Record<string, () => void> }))
vi.mock('leaflet', () => ({
  map: () => {
    if (maps.fail) throw new Error('map unavailable')
    const instance = { setView: vi.fn(), invalidateSize: vi.fn(), remove: vi.fn(),
      getCenter: () => ({ wrap: () => ({ lat: 35.7, lng: 51.4 }) }),
      on: (_name: string, callback: (event: unknown) => void) => { instance.click = callback },
      click: undefined as ((event: unknown) => void) | undefined }
    maps.instances.push(instance); return instance
  },
  tileLayer: () => ({ on: (name: string, callback: () => void) => { maps.tileEvents[name] = callback }, addTo: vi.fn() }),
  divIcon: vi.fn(), marker: (...args: unknown[]) => { maps.marker(...args); return { addTo() { return this }, setLatLng: vi.fn(), remove: vi.fn() } },
}))
beforeEach(() => { maps.instances = []; maps.fail = false; maps.tileEvents = {}; vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }) })
afterEach(() => vi.unstubAllGlobals())
const save = () => userEvent.click(screen.getByRole('button', { name: 'ثبت اصلاح معیارها' }))
const confirm = () => userEvent.click(screen.getByRole('button', { name: 'تأیید این مکان' }))
async function open(selected = false) {
  await userEvent.click(screen.getByRole('button', { name: selected ? 'تغییر مکان' : 'انتخاب محل روی نقشه' }))
}
async function manual(lat: string, lon: string) {
  await userEvent.click(screen.getByText('ورود دستی مختصات (پیشرفته / دسترس‌پذیری)'))
  fireEvent.change(screen.getByLabelText('عرض مرکز جست‌وجوی من'), { target: { value: lat } })
  fireEvent.change(screen.getByLabelText('طول مرکز جست‌وجوی من'), { target: { value: lon } })
}
function clickMap(lat = 35.72, lng = 51.42) {
  act(() => maps.instances.at(-1)!.click!({ latlng: { wrap: () => ({ lat, lng }) } }))
}
it('opening and cancelling do not edit or submit; initial viewport is not a selection', async () => {
  const submit = vi.fn(), edit = vi.fn()
  render(<IntentEditor fields={{}} disabled={false} onEdit={edit} onSubmit={submit} />)
  await open()
  expect(screen.getByText('هنوز نقطه‌ای انتخاب نکرده‌ای.')).toBeVisible()
  expect(maps.marker).not.toHaveBeenCalled()
  await confirm()
  expect(screen.getByRole('alert')).toHaveTextContent('ابتدا یک نقطه')
  await userEvent.click(screen.getByRole('button', { name: 'لغو انتخاب مکان' }))
  expect(screen.getByRole('button', { name: 'انتخاب محل روی نقشه' })).toHaveFocus()
  expect(edit).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled()
})
it('map candidates stay private until confirmation, then only explicit save emits a canonical patch', async () => {
  const submit = vi.fn(), edit = vi.fn()
  render(<IntentEditor fields={{ location: 'نام دقیق', product_query: 'گوشی', radius: '۵ کیلومتر' }} disabled={false} onEdit={edit} onSubmit={submit} />)
  await open(); clickMap(); clickMap(35.73, 51.43)
  expect(maps.marker).toHaveBeenCalledTimes(1)
  expect(edit).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled()
  await confirm()
  expect(edit).toHaveBeenCalledTimes(1); expect(submit).not.toHaveBeenCalled()
  await save()
  expect(submit).toHaveBeenCalledExactlyOnceWith({ coordinates: { latitude: 35.73, longitude: 51.43, for_location: 'نام دقیق' } })
  expect(screen.getByLabelText('شعاع جست‌وجو با واحد')).toHaveValue('۵ کیلومتر')
})
it('cancelling candidates preserves an existing out-of-area point after reopen', async () => {
  const submit = vi.fn(), edit = vi.fn()
  render(<IntentEditor fields={{ coordinates: { latitude: -40, longitude: -100 } }} disabled={false} onEdit={edit} onSubmit={submit} />)
  await open(true); clickMap()
  fireEvent.keyDown(screen.getByRole('region', { name: 'نقشهٔ انتخاب مرکز جست‌وجو' }), { key: 'Escape' })
  expect(screen.getByText('-40.00000, -100.00000')).toBeVisible()
  await open(true)
  expect(screen.getAllByText('-40.00000, -100.00000')).toHaveLength(2)
  expect(edit).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled()
})
it.each([['', '0'], ['91', '0'], ['0', '-181'], ['Infinity', '0'], ['NaN', '0']])('rejects invalid or partial coordinates %s/%s', async (lat, lon) => {
  const submit = vi.fn(), edit = vi.fn()
  render(<IntentEditor fields={{}} disabled={false} onEdit={edit} onSubmit={submit} />)
  await open(); await manual(lat, lon); await confirm()
  expect(screen.getByRole('alert')).toHaveTextContent('هر دو مختصات را معتبر وارد کن')
  expect(submit).not.toHaveBeenCalled(); expect(edit).not.toHaveBeenCalled()
})
it('accepts Persian/Arabic zero only after confirmation and binds the exact label', async () => {
  const submit = vi.fn()
  render(<IntentEditor fields={{ location: 'محدودهٔ انتخابی' }} disabled={false} onEdit={vi.fn()} onSubmit={submit} />)
  await open(); await manual('۰', '٠'); await confirm(); await save()
  expect(submit).toHaveBeenCalledExactlyOnceWith({ coordinates: { latitude: 0, longitude: 0, for_location: 'محدودهٔ انتخابی' } })
})
it.each([false, true])('invalidates association even after label reversion; reconfirm=%s', async reconfirm => {
  const submit = vi.fn()
  render(<IntentEditor fields={{ location: 'الف', coordinates: { latitude: 0, longitude: 0, for_location: 'الف' } }} disabled={false} onEdit={vi.fn()} onSubmit={submit} />)
  await userEvent.click(screen.getByText('اصلاح سایر معیارها و حذف محدودیت‌های پشتیبانی‌نشده'))
  fireEvent.change(screen.getByLabelText('نام محدودهٔ موردنظر'), { target: { value: 'ب' } })
  fireEvent.change(screen.getByLabelText('نام محدودهٔ موردنظر'), { target: { value: 'الف' } })
  expect(screen.getByText('مکان قبلی نیاز به تأیید دوباره دارد')).toBeVisible()
  if (reconfirm) { await open(true); await confirm() }
  await save()
  expect(submit).toHaveBeenCalledExactlyOnceWith({ coordinates: reconfirm ? { latitude: 0, longitude: 0, for_location: 'الف' } : null })
})
it('binds a reconfirmed unchanged pair to a newly edited label in one patch', async () => {
  const submit = vi.fn()
  render(<IntentEditor fields={{ location: 'الف', coordinates: { latitude: 0, longitude: 0, for_location: 'الف' } }} disabled={false} onEdit={vi.fn()} onSubmit={submit} />)
  fireEvent.change(screen.getByLabelText('نام محدودهٔ موردنظر'), { target: { value: 'ب' } })
  await open(true); await confirm(); await save()
  expect(submit).toHaveBeenCalledExactlyOnceWith({ location: 'ب', coordinates: { latitude: 0, longitude: 0, for_location: 'ب' } })
})
it('removes only the selected center explicitly and keeps radius', async () => {
  const submit = vi.fn()
  render(<IntentEditor fields={{ coordinates: { latitude: 35.7, longitude: 51.4 }, radius: '۵ کیلومتر' }} disabled={false} onEdit={vi.fn()} onSubmit={submit} />)
  await userEvent.click(screen.getByRole('button', { name: 'حذف مرکز انتخاب‌شده' })); await save()
  expect(submit).toHaveBeenCalledExactlyOnceWith({ coordinates: null })
  expect(screen.getByLabelText('شعاع جست‌وجو با واحد')).toHaveValue('۵ کیلومتر')
})
it('offers manual fallback on map initialization failure', async () => {
  maps.fail = true
  const submit = vi.fn()
  render(<IntentEditor fields={{}} disabled={false} onEdit={vi.fn()} onSubmit={submit} />)
  await open()
  expect(screen.getByText(/نقشه یا بخشی از تصویر/)).toBeVisible()
  await manual('90', '180'); await confirm(); await save()
  expect(submit).toHaveBeenCalledExactlyOnceWith({ coordinates: { latitude: 90, longitude: 180, for_location: null } })
})
it('cleans StrictMode maps, handles tile failure, keyboard selection and disabled state', async () => {
  const edit = vi.fn()
  const view = render(<StrictMode><IntentEditor fields={{}} disabled={false} onEdit={edit} onSubmit={vi.fn()} /></StrictMode>)
  await open()
  expect(maps.instances).toHaveLength(2)
  expect(maps.instances[0]!.remove).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(screen.getByRole('region', { name: 'نقشهٔ انتخاب مرکز جست‌وجو' }), { key: 'Enter' })
  expect(edit).not.toHaveBeenCalled()
  act(() => maps.tileEvents.tileerror!())
  expect(screen.getByText(/نقشه یا بخشی/)).toBeVisible()
  view.rerender(<StrictMode><IntentEditor fields={{}} disabled={true} onEdit={edit} onSubmit={vi.fn()} /></StrictMode>)
  expect(maps.instances[1]!.remove).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'انتخاب محل روی نقشه' })).toBeDisabled()
})
it('validates finite pairs and inclusive bounds without rejecting zero', () => {
  expect(validPoint({ latitude: 0, longitude: 0 })).toBe(true)
  expect(validPoint({ latitude: -90, longitude: -180 })).toBe(true)
  expect(validPoint({ latitude: NaN, longitude: 0 })).toBe(false)
  expect(validPoint({ latitude: 0, longitude: Infinity })).toBe(false)
})
