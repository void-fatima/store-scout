import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createdIntentFixture, readyIntentFixture, confirmedIntentFixture, intentJourneyFixture } from '../src/test/fixtures/intents'

// Deliberately synthetic tile. This verifies UI behavior, never live map loading.
const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#edf7ee"/><path d="M0 128H256 M128 0V256" stroke="#a0adba" stroke-width="6"/><text x="12" y="32" fill="#101b3d" font-size="18">TEST TILE</text></svg>`
async function assets(page: Page, fail = false) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.hostname === 'tile.openstreetmap.org') return fail ? route.abort() : route.fulfill({ contentType: 'image/svg+xml', body: tile })
    return ['localhost', '127.0.0.1'].includes(url.hostname) ? route.continue() : route.abort()
  })
}
async function start(page: Page) {
  await page.goto('/')
  await page.getByText('خرید را با یک پیام شروع کن', { exact: true }).click()
  await page.getByLabel('پیام خرید من').fill('گوشی سامسونگ تا ۳۰ میلیون تومان')
  await page.getByRole('button', { name: 'تفسیر پیام و ساخت پیش‌نویس' }).click()
  await expect(page.getByRole('button', { name: 'انتخاب محل روی نقشه' })).toBeVisible()
}
async function inspect(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  for (const control of await page.locator('.search-location button, .search-location summary, .search-location input, .leaflet-control-zoom a').all()) {
    if (!await control.isVisible()) continue
    const box = await control.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44)
  }
}

for (const width of [1440, 390, 360]) {
  test(`${width}: explicit map selection, exploration cancellation, focus and one revise before renewed consent`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    await assets(page)
    const patches: unknown[] = []
    let confirmations = 0, recommendations = 0
    await page.route('**/api/v1/journey/intents**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/revise')) { patches.push(route.request().postDataJSON()); return route.fulfill({ json: readyIntentFixture }) }
      if (path.endsWith('/confirm')) { confirmations++; return route.fulfill({ json: confirmedIntentFixture }) }
      if (path.endsWith('/recommendations')) { recommendations++; return route.fulfill({ json: intentJourneyFixture }) }
      return route.fulfill({ status: 201, json: createdIntentFixture })
    })
    await start(page)
    const trigger = page.getByRole('button', { name: 'انتخاب محل روی نقشه' })
    await trigger.click()
    const map = page.getByRole('region', { name: 'نقشهٔ انتخاب مرکز جست‌وجو' })
    await expect(page.getByRole('heading', { name: 'انتخاب مرکز جست‌وجو' })).toBeFocused()
    await expect(page.getByText('نقشه آمادهٔ انتخاب است.')).toBeVisible()
    await expect(page.locator('.search-location__marker')).toHaveCount(0)
    await expect(page.getByText('هنوز نقطه‌ای انتخاب نکرده‌ای.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'کنار گذاشتن ویرایش ارسال‌نشده' })).toHaveCount(0)
    await page.keyboard.press('Tab')
    await expect(map).toBeFocused()
    expect(await map.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid')
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('+')
    await expect(page.locator('.search-location__marker')).toHaveCount(0)
    await page.keyboard.press('Tab')
    await expect(map).not.toBeFocused()
    await map.focus(); await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    expect(patches).toEqual([])
    await trigger.click()
    await map.click({ position: { x: 140, y: 150 } })
    await map.click({ position: { x: 160, y: 160 } })
    await expect(page.locator('.search-location__marker')).toHaveCount(1)
    await inspect(page, width)
    await page.locator('.search-location').screenshot({ path: info.outputPath(`picker-${width}-intercepted.png`) })
    await page.getByRole('button', { name: 'تأیید این مکان' }).click()
    const change = page.getByRole('button', { name: 'تغییر مکان' })
    await expect(change).toBeFocused()
    const summary = await page.locator('.search-location__summary').textContent()
    expect(patches).toEqual([]); expect(recommendations).toBe(0)
    await change.click(); await map.focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'لغو انتخاب مکان' }).click()
    await expect(page.locator('.search-location__summary')).toHaveText(summary!)
    await expect(change).toBeFocused()
    await page.getByLabel('شعاع جست‌وجو با واحد').fill('۵ کیلومتر')
    await page.getByRole('button', { name: 'ثبت اصلاح معیارها' }).click()
    await expect(page.getByText('آمادهٔ بازبینی و تأیید', { exact: true })).toBeVisible()
    expect(patches).toHaveLength(1)
    expect(patches[0]).toEqual({ expected_revision: 0, changes: { coordinates: { latitude: expect.any(Number), longitude: expect.any(Number), for_location: null }, radius: '۵ کیلومتر' } })
    expect(confirmations).toBe(0); expect(recommendations).toBe(0)
    await expect(page.getByRole('button', { name: 'تأیید این نسخه و دیدن پیشنهادها' })).toBeDisabled()
    await inspect(page, width)
    await page.locator('.intent-editor').screenshot({ path: info.outputPath(`selected-${width}-intercepted.png`) })
    await page.getByRole('checkbox', { name: /خلاصهٔ نسخهٔ/ }).check()
    await page.getByRole('button', { name: 'تأیید این نسخه و دیدن پیشنهادها' }).click()
    await expect(page.getByRole('article')).not.toHaveCount(0)
    expect(recommendations).toBe(1); expect(confirmations).toBe(1)
  })
}

test('360 touch selection and tile failure preserve a usable manual fallback and exact label rebinding', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 900 }, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  await assets(page, true)
  const patches: unknown[] = []
  const created = structuredClone(createdIntentFixture)
  created.draft.fields.location = 'الف'
  created.draft.fields.coordinates = { latitude: -40, longitude: -100, for_location: 'الف' }
  await page.route('**/api/v1/journey/intents**', route => {
    if (route.request().url().endsWith('/revise')) { patches.push(route.request().postDataJSON()); return route.fulfill({ json: readyIntentFixture }) }
    return route.fulfill({ status: 201, json: created })
  })
  await page.goto('/')
  await page.getByText('خرید را با یک پیام شروع کن', { exact: true }).click()
  await page.getByLabel('پیام خرید من').fill('گوشی سامسونگ تا ۳۰ میلیون تومان')
  await page.getByRole('button', { name: 'تفسیر پیام و ساخت پیش‌نویس' }).click()
  await page.getByRole('button', { name: 'تغییر مکان' }).tap()
  await expect(page.getByText(/نقشه یا بخشی از تصویر/)).toBeVisible()
  await expect(page.locator('.search-location__summary')).toContainText('-40.00000, -100.00000')
  const map = page.getByRole('region', { name: 'نقشهٔ انتخاب مرکز جست‌وجو' })
  await map.tap({ position: { x: 120, y: 140 } })
  await expect(page.locator('.search-location__marker')).toHaveCount(1)
  await page.getByRole('button', { name: 'لغو انتخاب مکان' }).tap()
  await expect(page.locator('.search-location__summary')).toContainText('-40.00000, -100.00000')
  await page.getByText('اصلاح سایر معیارها و حذف محدودیت‌های پشتیبانی‌نشده').click()
  await page.getByLabel('نام محدودهٔ موردنظر').fill('نام جدید')
  await expect(page.getByText('مکان قبلی نیاز به تأیید دوباره دارد')).toBeVisible()
  await page.getByRole('button', { name: 'تغییر مکان' }).tap()
  await page.getByText('ورود دستی مختصات (پیشرفته / دسترس‌پذیری)').click()
  await page.getByLabel('عرض مرکز جست‌وجوی من').fill('91')
  await page.getByLabel('طول مرکز جست‌وجوی من').fill('0')
  await page.getByRole('button', { name: 'تأیید این مکان' }).tap()
  await expect(page.getByRole('alert')).toContainText('هر دو مختصات را معتبر وارد کن')
  await page.getByLabel('عرض مرکز جست‌وجوی من').fill('۰')
  await inspect(page, 360)
  await page.locator('.search-location').screenshot({ path: info.outputPath('failure-fallback-360-intercepted.png') })
  await page.getByRole('button', { name: 'تأیید این مکان' }).tap()
  await expect(page.getByRole('button', { name: 'تغییر مکان' })).toBeFocused()
  expect(patches).toHaveLength(0)
  await page.getByRole('button', { name: 'ثبت اصلاح معیارها' }).click()
  await expect(page.getByText('آمادهٔ بازبینی و تأیید', { exact: true })).toBeVisible()
  expect(patches).toEqual([{ expected_revision: 0, changes: { location: 'نام جدید', coordinates: { latitude: 0, longitude: 0, for_location: 'نام جدید' } } }])
  await context.close()
})

test('actual fixture-only HTTP saves map point with current revision then requires overall confirmation', async ({ page, request }) => {
  test.skip(!process.env.STORE_SCOUT_INTENT_API, 'Requires disposable fixture interpreter')
  const api = process.env.STORE_SCOUT_INTENT_API!
  expect(['localhost', '127.0.0.1']).toContain(new URL(api).hostname)
  expect((await request.get(`${api}/health`)).headers()['x-storescout-interpretation']).toBe('fixture-only-18756bf')
  await assets(page)
  const revisions: unknown[] = []
  let searches = 0
  page.on('request', request => {
    if (request.url().endsWith('/revise')) revisions.push(request.postDataJSON())
    if (request.method() === 'POST' && request.url().endsWith('/recommendations')) searches++
  })
  await start(page)
  await page.getByRole('button', { name: 'انتخاب محل روی نقشه' }).click()
  const map = page.getByRole('region', { name: 'نقشهٔ انتخاب مرکز جست‌وجو' })
  await map.focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'تأیید این مکان' }).click()
  await page.getByLabel('شعاع جست‌وجو با واحد').fill('۵ کیلومتر')
  expect(searches).toBe(0); expect(revisions).toHaveLength(0)
  await page.getByRole('button', { name: 'ثبت اصلاح معیارها' }).click()
  await expect(page.getByText('نسخهٔ ۱', { exact: true })).toBeVisible()
  expect(revisions).toEqual([{ expected_revision: 0, changes: { coordinates: { latitude: expect.closeTo(35.7, 3), longitude: expect.closeTo(51.4, 3), for_location: null }, radius: '۵ کیلومتر' } }])
  expect(searches).toBe(0)
  await expect(page.getByRole('button', { name: 'تأیید این نسخه و دیدن پیشنهادها' })).toBeDisabled()
  await page.getByRole('checkbox', { name: /خلاصهٔ نسخهٔ/ }).check()
  await page.getByRole('button', { name: 'تأیید این نسخه و دیدن پیشنهادها' }).click()
  await expect(page.getByRole('article')).not.toHaveCount(0)
  expect(searches).toBe(1)
})
