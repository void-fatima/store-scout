import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { JourneyRecommendations } from '../src/contracts'
import { createdIntentFixture, readyIntentFixture, confirmedIntentFixture, intentJourneyFixture } from '../src/test/fixtures/intents'

const viewports = [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844], ['narrow', 360, 844]] as const
const confirmButton = (page: Page) => page.getByRole('button', { name: 'تأیید این نسخه و دیدن پیشنهادها', exact: true })
const consentBox = (page: Page) => page.getByRole('checkbox', { name: /خلاصهٔ نسخهٔ/ })
async function inspect(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id))
  expect(new Set(ids).size).toBe(ids.length)
  for (const target of await page.locator('.conversation button, .conversation input:not([type="checkbox"]), .conversation summary, .intent-check').all()) {
    if (!await target.isVisible()) continue
    const box = await target.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
}
async function open(page: Page, message: string) {
  await page.goto('/')
  await page.getByText('خرید را با یک پیام شروع کن', { exact: true }).click()
  await page.getByLabel('پیام خرید من').fill(message)
  await page.getByRole('button', { name: 'تفسیر پیام و ساخت پیش‌نویس' }).click()
  await expect(page.getByText('نیاز به توضیح بیشتر', { exact: true })).toBeVisible()
}
async function coordinates(page: Page) {
  await page.getByRole('button', { name: 'انتخاب محل روی نقشه' }).click()
  await page.getByText('ورود دستی مختصات (پیشرفته / دسترس‌پذیری)').click()
  await page.getByLabel('عرض مرکز جست‌وجوی من').fill('۳۵٫۷')
  await page.getByLabel('طول مرکز جست‌وجوی من').fill('۵۱٫۴')
  await page.getByLabel('شعاع جست‌وجو با واحد').fill('۵ کیلومتر')
  await page.getByRole('button', { name: 'تأیید این مکان' }).click()
  await page.getByRole('button', { name: 'ثبت اصلاح معیارها' }).click()
  await expect(page.getByText('آمادهٔ بازبینی و تأیید', { exact: true })).toBeVisible()
}
async function blockExternal(page: Page) {
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname
    return ['localhost', '127.0.0.1'].includes(host) ? route.continue() : route.abort()
  })
}

for (const [name, width, height] of viewports) {
  test(`${name}: actual fixture-interpreted HTTP clarifies, confirms and renders canonical Journey`, async ({ page, request }, info) => {
    test.skip(!process.env.STORE_SCOUT_INTENT_API, 'Requires disposable fixture-interpreted API, no paid model')
    const api = process.env.STORE_SCOUT_INTENT_API!
    expect(['localhost', '127.0.0.1']).toContain(new URL(api).hostname)
    expect((await request.get(`${api}/health`)).headers()['x-storescout-interpretation']).toBe('fixture-only-18756bf')
    await page.setViewportSize({ width, height })
    await blockExternal(page)
    let executions = 0, confirmations = 0, legacy = 0
    page.on('request', request => {
      if (request.method() !== 'POST') return
      const path = new URL(request.url()).pathname
      if (/intents\/[^/]+\/recommendations$/.test(path)) executions++
      if (path.endsWith('/confirm')) confirmations++
      if (path === '/api/v1/journey/recommendations') legacy++
    })
    // API requests are actual HTTP; only external assets are blocked.
    await open(page, 'گوشی سامسونگ تا ۳۰ تومن')
    await expect(page.getByRole('heading', { name: 'از نیازت بگو' })).toBeFocused()
    expect(executions).toBe(0)
    await inspect(page, width)
    await page.locator('.conversation').screenshot({ path: info.outputPath(`conversation-review-${name}-http.png`) })
    await page.screenshot({ path: info.outputPath(`conversation-clarification-${name}-http.png`), fullPage: true })
    await page.getByLabel('پاسخ یا توضیح تکمیلی من').fill('منظورم ۳۰ میلیون تومان بود')
    await page.getByRole('button', { name: 'ارسال توضیح و ساخت نسخهٔ تازه' }).click()
    await expect(page.getByText('نسخهٔ ۱', { exact: true })).toBeVisible()
    await coordinates(page)
    expect(executions).toBe(0)
    await expect(confirmButton(page)).toBeDisabled()
    await consentBox(page).focus()
    await page.keyboard.press('Space')
    await expect(consentBox(page)).toBeChecked()
    await page.keyboard.press('Tab')
    await expect(confirmButton(page)).toBeFocused()
    expect(await confirmButton(page).evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid')
    await inspect(page, width)
    await page.screenshot({ path: info.outputPath(`conversation-confirmation-${name}-http.png`), fullPage: true })
    const responsePromise = page.waitForResponse(response => /intents\/[^/]+\/recommendations$/.test(new URL(response.url()).pathname))
    await page.keyboard.press('Enter')
    const response = await responsePromise
    expect(response.status()).toBe(200)
    const journey: JourneyRecommendations = await response.json()
    await expect(page.getByRole('article')).toHaveCount(journey.result.original.recommendations.length)
    await expect(page.getByRole('heading', { name: 'پیشنهادهای مناسب تو' })).toBeFocused()
    const article = page.getByRole('article').first()
    await article.getByRole('checkbox').check()
    await article.getByRole('link', { name: 'مشخصات کالا', exact: true }).click()
    await page.getByRole('tab', { name: 'قبل از خرید بررسی کن' }).click()
    const purchase = page.getByRole('tabpanel', { name: 'قبل از خرید بررسی کن' })
    await expect(purchase.getByRole('checkbox', { name: /^یادآوری شخصی:/ })).toHaveCount(journey.result.original_verification[0]!.checklist.length)
    await purchase.getByRole('checkbox', { name: /^یادآوری شخصی:/ }).first().check()
    await page.getByRole('tab', { name: 'تناسب با نیاز من' }).click()
    await page.getByRole('tab', { name: 'قبل از خرید بررسی کن' }).click()
    await expect(purchase.getByRole('checkbox', { name: /^یادآوری شخصی:/ }).first()).not.toBeChecked()
    await expect(page.getByRole('checkbox', { name: /^مقایسهٔ/ })).toBeChecked()
    expect(executions).toBe(1); expect(confirmations).toBe(1); expect(legacy).toBe(0)
    const shop = journey.result.original.recommendations[0]!.candidate.shop
    const location = purchase.getByRole('region', { name: 'مکان ثبت‌شدهٔ فروشگاه' })
    await expect(location.getByText(shop.address!, { exact: true })).toBeVisible()
    await expect(location.locator('iframe')).toHaveAttribute('src', new RegExp(`marker=${shop.lat}%2C${shop.lon}`))
    await inspect(page, width)
    await page.screenshot({ path: info.outputPath(`conversation-purchase-${name}-http.png`), fullPage: true })
    await page.getByRole('link', { name: 'بازگشت به پیشنهادها', exact: true }).click()
    await expect(page.getByRole('article').first().getByRole('link', { name: 'مشخصات کالا', exact: true })).toBeFocused()
    await page.getByRole('article').first().getByRole('link', { name: 'چک‌لیست پیش از مراجعه', exact: true }).click()
    const checklistLocation = page.getByRole('region', { name: 'مکان ثبت‌شدهٔ فروشگاه' })
    await expect(checklistLocation.getByText(shop.address!, { exact: true })).toBeVisible()
    await expect(checklistLocation.locator('iframe')).toHaveAttribute('src', new RegExp(`marker=${shop.lat}%2C${shop.lon}`))
    await inspect(page, width)
    await page.screenshot({ path: info.outputPath(`conversation-checklist-map-${name}-http.png`), fullPage: true })
    expect(await page.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length)).toBe(0)
  })
}

test('intercepted stale confirmation cannot execute until refreshed and explicitly reviewed again', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await blockExternal(page)
  let confirms = 0, executions = 0
  await page.route('**/api/v1/journey/intents**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/journey/intents') return route.fulfill({ status: 201, json: createdIntentFixture })
    if (path.endsWith('/revise')) return route.fulfill({ json: readyIntentFixture })
    if (path.endsWith('/confirm')) {
      confirms++
      if (confirms === 1) return route.fulfill({ status: 409, json: { error: { code: 'stale_intent', message: 'private upstream', details: [] } } })
      return route.fulfill({ json: confirmedIntentFixture })
    }
    if (path.endsWith('/recommendations')) { executions++; return route.fulfill({ json: intentJourneyFixture }) }
    return route.fulfill({ json: readyIntentFixture })
  })
  await open(page, 'گوشی سامسونگ تا ۳۰ میلیون تومان')
  await coordinates(page)
  await consentBox(page).check(); await confirmButton(page).click()
  await expect(page.getByRole('alert')).toContainText('این نسخه تغییر کرده است')
  await expect(confirmButton(page)).toBeDisabled()
  expect(executions).toBe(0)
  await page.getByRole('button', { name: 'بازیابی نسخهٔ فعلی' }).click()
  await expect(consentBox(page)).not.toBeChecked()
  await expect(confirmButton(page)).toBeDisabled()
  await inspect(page, 360)
  await page.screenshot({ path: info.outputPath('conversation-stale-recovered-360-intercepted.png'), fullPage: true })
  await consentBox(page).check(); await confirmButton(page).click()
  await expect(page.getByRole('article')).toHaveCount(intentJourneyFixture.result.original.recommendations.length)
  expect(executions).toBe(1)
})

test('actual fixture HTTP keeps unaccepted alternatives and the explicit legacy acceptance flow', async ({ page, request }, info) => {
  test.skip(!process.env.STORE_SCOUT_INTENT_API, 'Requires disposable fixture-only API')
  const api = process.env.STORE_SCOUT_INTENT_API!
  expect(['localhost', '127.0.0.1']).toContain(new URL(api).hostname)
  expect((await request.get(`${api}/health`)).headers()['x-storescout-interpretation']).toBe('fixture-only-18756bf')
  await page.setViewportSize({ width: 390, height: 844 })
  await blockExternal(page)
  let legacy = 0
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/v1/journey/recommendations' && request.method() === 'POST') legacy++
  })
  await open(page, 'گوشی سامسونگ تا ۱۸ میلیون تومان')
  await coordinates(page)
  await consentBox(page).check()
  await confirmButton(page).click()
  await page.getByRole('link', { name: /دیدن جایگزین‌ها/ }).click()
  expect(legacy).toBe(0)
  await page.getByRole('article').first().getByRole('link', { name: 'مشخصات کالا', exact: true }).click()
  await page.getByRole('tab', { name: 'تناسب با نیاز من' }).click()
  await expect(page.getByRole('tabpanel', { name: 'تناسب با نیاز من' })).toContainText('معیارهای پیشنهادی')
  await page.getByRole('link', { name: 'بازگشت به جایگزین‌ها', exact: true }).click()
  await page.getByRole('link', { name: 'بررسی تغییرهای این جایگزین', exact: true }).first().click()
  await page.getByRole('button', { name: 'مرور و تأیید تغییرها' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('checkbox').check()
  const fresh = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/journey/recommendations' && response.request().method() === 'POST')
  await dialog.getByRole('button', { name: 'پذیرش و جست‌وجوی تازه' }).click()
  expect((await fresh).status()).toBe(200)
  await expect(page.getByRole('article')).not.toHaveCount(0)
  expect(legacy).toBe(1)
  await page.screenshot({ path: info.outputPath('conversation-accepted-alternative-mobile-http.png'), fullPage: true })
})

test('intercepted unavailable interpretation keeps the typed form and safe text; no automatic retry', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await blockExternal(page)
  let requests = 0
  await page.route('**/api/v1/journey/intents', async route => {
    requests++
    await route.fulfill({ status: 503, json: { error: { code: 'llm_authentication', message: 'secret-token', details: [] } } })
  })
  await page.goto('/')
  await page.getByText('خرید را با یک پیام شروع کن', { exact: true }).click()
  await page.getByLabel('پیام خرید من').fill('گوشی')
  await page.getByRole('button', { name: 'تفسیر پیام و ساخت پیش‌نویس' }).click()
  await expect(page.getByRole('alert')).toContainText('درخواست انجام نشد')
  await expect(page.getByLabel('پیام خرید من')).toHaveValue('گوشی')
  await expect(page.getByText('secret-token')).toHaveCount(0)
  await expect(page.getByLabel('نام کالا', { exact: true })).toBeVisible()
  await inspect(page, 360)
  expect(requests).toBe(1)
  await page.screenshot({ path: info.outputPath('conversation-unavailable-360-intercepted.png'), fullPage: true })
})
