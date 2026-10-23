import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import type { IntentClient } from '../../api/intent'
import type { JourneyClient } from '../../api/journey'
import { createIntentClient } from '../../api/intent'
import { useJourneyController } from '../../journey/useJourneyController'
import { JourneyFlow } from '../../journey/JourneyFlow'
import { RecommendationPanel } from '../recommendation/RecommendationPanel'
import { responseEntries } from '../../journey/operations'
import { productHash } from '../recommendation/presentation'
import { createdIntentFixture, confirmedIntentFixture, readyIntentFixture, rejectedIntentFixture, intentJourneyFixture } from '../../test/fixtures/intents'

afterEach(() => { window.history.replaceState(null, '', '/'); vi.useRealTimers(); vi.unstubAllGlobals() })
function fixtureClient(): IntentClient {
  return {
    create: vi.fn().mockResolvedValue({ ok: true, value: structuredClone(createdIntentFixture) }),
    get: vi.fn().mockResolvedValue({ ok: true, value: structuredClone(readyIntentFixture) }),
    revise: vi.fn().mockResolvedValue({ ok: true, value: structuredClone(readyIntentFixture) }),
    confirm: vi.fn().mockResolvedValue({ ok: true, value: structuredClone(confirmedIntentFixture) }),
    reject: vi.fn().mockResolvedValue({ ok: true, value: structuredClone(rejectedIntentFixture) }),
    recommendations: vi.fn().mockResolvedValue({ ok: true, value: structuredClone(intentJourneyFixture) }),
  }
}
function Harness({ client, legacy = vi.fn<JourneyClient>() }: { client: IntentClient; legacy?: JourneyClient }) {
  const controller = useJourneyController({ client: legacy })
  return <><JourneyFlow Panel={RecommendationPanel} intentClient={client} controller={controller} />
    <output aria-label="owning-request">{controller.state.requestId}:{controller.state.revision}</output>
    <output aria-label="selection-count">{controller.state.comparison.length}</output>
    <output aria-label="owning-plan">{controller.state.selectedVerification?.key.offer_id ?? 'none'}</output></>
}
async function start(client: IntentClient = fixtureClient()) {
  window.history.replaceState(null, '', '#search')
  render(<Harness client={client} />)
  const user = userEvent.setup()
  await user.click(screen.getByText('خرید را با یک پیام شروع کن', { exact: true }))
  await user.type(await screen.findByLabelText('پیام خرید من'), 'گوشی سامسونگ تا ۳۰ میلیون تومان')
  await user.click(screen.getByRole('button', { name: 'تفسیر پیام و ساخت پیش‌نویس' }))
  await screen.findByText('نیاز به توضیح بیشتر', { exact: true })
  return { user, client }
}
async function complete(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('عرض مرکز جست‌وجوی من'), '۳۵٫۷')
  await user.type(screen.getByLabelText('طول مرکز جست‌وجوی من'), '۵۱٫۴')
  await user.type(screen.getByLabelText('شعاع جست‌وجو با واحد'), '۵ کیلومتر')
  await user.click(screen.getByRole('checkbox', { name: 'این مختصات را از محل انتخابی خودم وارد کرده‌ام.' }))
  await user.click(screen.getByRole('button', { name: 'ثبت اصلاح معیارها' }))
  await screen.findByText('آمادهٔ بازبینی و تأیید', { exact: true })
}
const consent = () => screen.getByRole('checkbox', { name: /خلاصهٔ نسخهٔ/ })
const confirm = () => screen.getByRole('button', { name: 'تأیید این نسخه و دیدن پیشنهادها' })

it('runs message → user-supplied center/radius → explicit confirmation → existing Journey results', async () => {
  const client = fixtureClient(), legacy = vi.fn<JourneyClient>()
  window.history.replaceState(null, '', '#search')
  render(<Harness client={client} legacy={legacy} />)
  const user = userEvent.setup()
  await user.click(screen.getByText('خرید را با یک پیام شروع کن', { exact: true }))
  await user.type(await screen.findByLabelText('پیام خرید من'), 'گوشی سامسونگ تا ۳۰ میلیون تومان')
  await user.click(screen.getByRole('button', { name: 'تفسیر پیام و ساخت پیش‌نویس' }))
  await screen.findByText('نیاز به توضیح بیشتر', { exact: true })
  expect(client.recommendations).not.toHaveBeenCalled()
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  await complete(user)
  expect(client.revise).toHaveBeenCalledWith(expect.objectContaining({ draftId: readyIntentFixture.draft_id }),
    expect.anything(), { expected_revision: 0, changes: { coordinates: { latitude: 35.7, longitude: 51.4, for_location: null }, radius: '۵ کیلومتر' } }, expect.any(AbortSignal))
  expect(confirm()).toBeDisabled()
  await user.click(consent())
  await user.click(confirm())
  await screen.findAllByRole('article')
  expect(client.confirm).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expected_revision: 1, confirm: true }, expect.any(AbortSignal))
  expect(client.recommendations).toHaveBeenCalledTimes(1)
  expect(legacy).not.toHaveBeenCalled()
  expect(screen.getByLabelText('owning-request')).toHaveTextContent(`${readyIntentFixture.draft_id}:1`)
  await user.click(screen.getAllByRole('checkbox', { name: /^مقایسهٔ/ })[0]!)
  expect(screen.getByLabelText('selection-count')).toHaveTextContent('1')
  const entry = responseEntries(intentJourneyFixture.result)[0]!
  act(() => { window.location.hash = productHash(entry.key, 'purchase'); window.dispatchEvent(new HashChangeEvent('hashchange')) })
  await screen.findByRole('region', { name: 'سؤال‌های پیش از خرید' })
  expect(screen.getByLabelText('owning-plan')).toHaveTextContent(entry.key.offer_id)
  expect(screen.getAllByText('در انتظار بررسی', { exact: true })).toHaveLength(entry.plan!.checklist.length)
  expect(document.body.textContent).not.toContain(createdIntentFixture.access_token)
  expect(window.localStorage.length).toBe(0)
})

it('natural confirmation is just clarification; local edits clear explicit consent until saved or discarded', async () => {
  const { user, client } = await start()
  await complete(user)
  await user.click(consent())
  await user.type(screen.getByLabelText('پاسخ یا توضیح تکمیلی من'), 'تأیید می‌کنم')
  expect(consent()).not.toBeChecked()
  expect(confirm()).toBeDisabled()
  expect(client.confirm).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'کنار گذاشتن ویرایش ارسال‌نشده' }))
  expect(screen.getByLabelText('پاسخ یا توضیح تکمیلی من')).toHaveValue('')
  expect(confirm()).toBeDisabled()
  await user.type(screen.getByLabelText('پاسخ یا توضیح تکمیلی من'), 'تأیید می‌کنم')
  const next = { ...structuredClone(readyIntentFixture), revision: 2 }
  vi.mocked(client.revise).mockResolvedValueOnce({ ok: true, value: next })
  await user.click(screen.getByRole('button', { name: 'ارسال توضیح و ساخت نسخهٔ تازه' }))
  await waitFor(() => expect(screen.getByText('نسخهٔ ۲', { exact: true })).toBeVisible())
  expect(client.confirm).not.toHaveBeenCalled()
  expect(client.recommendations).not.toHaveBeenCalled()
})

it('blocks stale revisions, safely refreshes and requires renewed consent', async () => {
  const { user, client } = await start()
  await complete(user)
  vi.mocked(client.confirm).mockResolvedValueOnce({ ok: false, failure: { kind: 'api', status: 409, error: { error: { code: 'stale_intent', message: 'private', details: [] } } } })
  await user.click(consent()); await user.click(confirm())
  expect(await screen.findByRole('alert')).toHaveTextContent('این نسخه تغییر کرده است')
  expect(screen.queryByText('private')).not.toBeInTheDocument()
  expect(confirm()).toBeDisabled()
  expect(client.recommendations).not.toHaveBeenCalled()
  vi.mocked(client.get).mockResolvedValueOnce({ ok: true, value: { ...structuredClone(readyIntentFixture), revision: 2 } })
  await user.click(screen.getByRole('button', { name: 'بازیابی نسخهٔ فعلی' }))
  await screen.findByText('نسخهٔ ۲', { exact: true })
  expect(consent()).not.toBeChecked()
  expect(confirm()).toBeDisabled()
})

it('retains failed clarification text, supports rejecting and never searches a rejected draft', async () => {
  const { user, client } = await start()
  await user.type(screen.getByLabelText('پاسخ یا توضیح تکمیلی من'), 'پاسخ من')
  vi.mocked(client.revise).mockResolvedValueOnce({ ok: false, failure: { kind: 'api', status: 503, error: { error: { code: 'llm_timeout', message: 'private', details: [] } } } })
  await user.click(screen.getByRole('button', { name: 'ارسال توضیح و ساخت نسخهٔ تازه' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('پاسخ یا توضیح تکمیلی من')).toHaveValue('پاسخ من')
  const rejected = { ...structuredClone(rejectedIntentFixture), revision: 1 }
  vi.mocked(client.reject).mockResolvedValueOnce({ ok: true, value: rejected })
  await user.click(screen.getByRole('button', { name: 'رد این پیش‌نویس' }))
  await screen.findByText('پیش‌نویس رد شده است', { exact: true })
  expect(screen.queryByRole('button', { name: 'تأیید این نسخه و دیدن پیشنهادها' })).not.toBeInTheDocument()
  expect(client.recommendations).not.toHaveBeenCalled()
})

it('ignores late creation after reset and rejects duplicate submit while pending', async () => {
  let resolve!: (value: Awaited<ReturnType<IntentClient['create']>>) => void
  const client = fixtureClient()
  vi.mocked(client.create).mockImplementation(() => new Promise(done => { resolve = done }))
  render(<Harness client={client} />)
  const user = userEvent.setup()
  await user.click(screen.getByText('خرید را با یک پیام شروع کن', { exact: true }))
  await user.type(await screen.findByLabelText('پیام خرید من'), 'گوشی')
  await user.dblClick(screen.getByRole('button', { name: 'تفسیر پیام و ساخت پیش‌نویس' }))
  expect(client.create).toHaveBeenCalledTimes(1)
  await user.click(screen.getByRole('button', { name: 'گفت‌وگوی تازه و کنار گذاشتن نتیجهٔ قبلی' }))
  await act(async () => { resolve({ ok: true, value: structuredClone(createdIntentFixture) }) })
  expect(screen.queryByText('نیاز به توضیح بیشتر', { exact: true })).not.toBeInTheDocument()
  expect(screen.getByLabelText('پیام خرید من')).toHaveValue('')
})

it('does not execute an old confirmation after the independent typed form changes', async () => {
  const { user, client } = await start()
  await complete(user)
  let resolve!: (value: Awaited<ReturnType<IntentClient['confirm']>>) => void
  vi.mocked(client.confirm).mockImplementation(() => new Promise(done => { resolve = done }))
  await user.click(consent()); await user.click(confirm())
  await user.type(screen.getByLabelText('نام کالا', { exact: true }), 'دیگر')
  await act(async () => { resolve({ ok: true, value: structuredClone(confirmedIntentFixture) }) })
  expect(client.recommendations).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('معیارهای فرم یا جست‌وجوی فعال تغییر کرده‌اند')
})

it('does not let a late execution repopulate results after a new conversation', async () => {
  const { user, client } = await start()
  await complete(user)
  let resolve!: (value: Awaited<ReturnType<IntentClient['recommendations']>>) => void
  vi.mocked(client.recommendations).mockImplementation(() => new Promise(done => { resolve = done }))
  await user.click(consent()); await user.click(confirm())
  await waitFor(() => expect(client.recommendations).toHaveBeenCalledTimes(1))
  await user.click(screen.getByRole('button', { name: 'گفت‌وگوی تازه و کنار گذاشتن نتیجهٔ قبلی' }))
  await act(async () => { resolve({ ok: true, value: structuredClone(intentJourneyFixture) }) })
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.getByLabelText('owning-plan')).toHaveTextContent('none')
})

it('preserves unsupported conditions and sends removal only as an explicit selected-field change', async () => {
  const client = fixtureClient()
  const draft = structuredClone(createdIntentFixture)
  draft.draft.fields.min_budget = '۱۰ میلیون تومان'
  draft.draft.fields.warranty = 'حتماً گارانتی'
  draft.draft.issues.push({ field: 'min_budget', code: 'unsupported', question: 'حداقل بودجه پشتیبانی نمی‌شود؛ حذفش می‌کنی؟' })
  vi.mocked(client.create).mockResolvedValueOnce({ ok: true, value: draft })
  const { user } = await start(client)
  expect(screen.getByText('حداقل بودجه پشتیبانی نمی‌شود؛ حذفش می‌کنی؟')).toBeVisible()
  expect(client.revise).not.toHaveBeenCalled()
  await user.click(screen.getByText('اصلاح سایر معیارها و حذف محدودیت‌های پشتیبانی‌نشده', { exact: true }))
  await user.clear(screen.getByLabelText('حداقل بودجه', { exact: true }))
  await user.click(screen.getByRole('button', { name: 'ثبت اصلاح معیارها' }))
  expect(client.revise).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expected_revision: 0, changes: { min_budget: null } }, expect.any(AbortSignal))
})

it('renders untrusted summary/evidence as text without leaking the capability', async () => {
  const client = fixtureClient()
  const fixture = structuredClone(createdIntentFixture)
  fixture.draft.summary.push({ label: '<script>name</script>', value: '<img src=x onerror=attack()>' })
  vi.mocked(client.create).mockResolvedValueOnce({ ok: true, value: fixture })
  await start(client)
  expect(screen.getByText('<img src=x onerror=attack()>')).toBeVisible()
  expect(document.querySelector('.conversation img, .conversation script')).toBeNull()
  expect(document.body.textContent).not.toContain(fixture.access_token)
})

it('expires a draft locally without executing or implicitly renewing it', async () => {
  const { user, client } = await start()
  await complete(user)
  await user.click(consent())
  vi.spyOn(Date, 'now').mockReturnValue((readyIntentFixture.expires_at + 1) * 1000)
  await waitFor(() => expect(screen.getByText(/زمان این پیش‌نویس پایان یافته/)).toBeVisible(), { timeout: 2000 })
  expect(confirm()).toBeDisabled()
  expect(client.recommendations).not.toHaveBeenCalled()
  vi.mocked(Date.now).mockRestore()
})

it('keeps retries on the confirmed endpoint and never resubmits the preview to legacy search', async () => {
  const client = fixtureClient()
  vi.mocked(client.recommendations).mockResolvedValueOnce({ ok: false, failure: { kind: 'api', status: 503, error: { error: { code: 'catalog_unavailable', message: '', details: [] } } } })
  const { user } = await start(client)
  await complete(user); await user.click(consent()); await user.click(confirm())
  const results = screen.getByRole('region', { name: 'نتیجهٔ جست‌وجو' })
  await within(results).findByRole('button', { name: /تلاش دوباره/ })
  await user.click(within(results).getByRole('button', { name: /تلاش دوباره/ }))
  await screen.findAllByRole('article')
  expect(client.confirm).toHaveBeenCalledTimes(1)
  expect(client.recommendations).toHaveBeenCalledTimes(2)
})

it('performs no HTTP when only opening the conversation', async () => {
  const fetcher = vi.fn<typeof fetch>()
  render(<Harness client={createIntentClient({ fetcher })} />)
  await userEvent.click(screen.getByText('خرید را با یک پیام شروع کن', { exact: true }))
  expect(fetcher).not.toHaveBeenCalled()
})
