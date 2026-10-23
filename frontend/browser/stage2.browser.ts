import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { JourneyRecommendations, ShoppingRequest } from '../src/contracts'
import { acceptedJourneyFixture, journeyFixture } from '../src/test/fixtures/contracts'

const endpoint = '**/api/v1/journey/recommendations'
async function search(page: Page, source = journeyFixture) {
  const criteria = source.result.original_constraints
  await page.getByLabel('نام کالا', { exact: true }).fill(criteria.query)
  await page.getByLabel('حداکثر بودجه', { exact: true }).fill(criteria.max_budget)
  await page.getByLabel('واحد بودجه').selectOption(criteria.price_unit)
  await page.getByLabel('عرض جغرافیایی محل انتخابی').fill(String(criteria.latitude))
  await page.getByLabel('طول جغرافیایی محل انتخابی').fill(String(criteria.longitude))
  if (criteria.max_distance_km != null) await page.getByLabel('شعاع جست‌وجو (کیلومتر، اختیاری)').fill(String(criteria.max_distance_km))
  await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
}
function associated(source: JourneyRecommendations, request: ShoppingRequest) {
  const value = structuredClone(source)
  value.state.request_id = request.request_id
  value.state.revision = request.revision
  return value
}
async function reviewFirst(page: Page) {
  await page.getByRole('link', { name: /دیدن جایگزین‌ها/ }).click()
  await page.getByRole('link', { name: 'بررسی تغییرهای این جایگزین' }).first().click()
}
async function accessibility(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
}

for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844], ['narrow', 360, 844]] as const) {
  test(`${name}: intercepted alternative review, native dialog cancellation and canonical checklist`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    const requests: ShoppingRequest[] = []
    await page.route(endpoint, async route => {
      const request = route.request().postDataJSON() as ShoppingRequest
      requests.push(request)
      await route.fulfill({ json: associated(journeyFixture, request) })
    })
    await page.goto('/')
    await search(page)
    await page.getByRole('link', { name: /دیدن جایگزین‌ها/ }).click()
    await expect(page.getByRole('heading', { name: 'با یک تغییر، گزینه‌های بیشتری ببین' })).toBeFocused()
    await accessibility(page, width)
    await page.screenshot({ path: info.outputPath(`stage2-alternatives-${name}.png`), fullPage: true })
    await page.getByRole('article').first().getByRole('checkbox').check()
    await page.getByRole('link', { name: 'بررسی تغییرهای این جایگزین' }).first().click()
    const review = page.getByRole('button', { name: 'مرور و تأیید تغییرها' })
    await expect(page.getByRole('heading', { name: 'این جایگزین چه تغییری می‌خواهد؟' })).toBeFocused()
    await page.screenshot({ path: info.outputPath(`stage2-review-${name}.png`), fullPage: true })
    await review.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'مرور و تأیید تغییرهای جست‌وجو' })).toBeFocused()
    await expect(dialog.getByRole('button', { name: 'پذیرش و جست‌وجوی تازه' })).toBeDisabled()
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
    await accessibility(page, width)
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`stage2-consent-${name}.png`), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(review).toBeFocused()
    expect(requests).toHaveLength(1)
    await page.getByRole('link', { name: 'چک‌لیست پیش از مراجعه' }).click()
    await expect(page.getByRole('heading', { name: 'چک‌لیست پیش از مراجعه' })).toBeFocused()
    const questions = page.getByRole('checkbox', { name: /^یادآوری شخصی:/ })
    await expect(questions).toHaveCount(journeyFixture.result.suggestions[0]!.verification.checklist.length)
    await questions.first().focus()
    await page.keyboard.press('Space')
    await expect(questions.first()).toBeChecked()
    await expect(page.getByText('در انتظار بررسی', { exact: true })).toHaveCount(journeyFixture.result.suggestions[0]!.verification.checklist.length)
    await expect(page.getByText(/تماسی با فروشنده انجام نشده است/)).toBeVisible()
    await accessibility(page, width)
    for (const target of await page.locator('.personal-reminder, .outline-action, .question-evidence summary').all()) {
      if (await target.isVisible()) {
        const box = await target.boundingBox()
        expect(box?.height).toBeGreaterThanOrEqual(44)
        expect(box?.width).toBeGreaterThanOrEqual(44)
      }
    }
    await page.screenshot({ path: info.outputPath(`stage2-checklist-${name}.png`), fullPage: true })
    await page.getByRole('link', { name: 'بازگشت به جایگزین', exact: true }).click()
    await page.getByRole('button', { name: 'مرور و تأیید تغییرها' }).click()
    await dialog.getByRole('button', { name: 'انصراف' }).click()
    expect(requests).toHaveLength(1)
    await page.getByRole('link', { name: 'مقایسهٔ گزینه‌ها' }).click()
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('row', { name: /^نوع نتیجه/ })).toContainText('نیازمند پذیرش تغییرهاست')
    expect(requests).toHaveLength(1)
  })
}

for (const [name, width] of [['desktop', 1440], ['mobile', 390]] as const) {
  test(`${name}: intercepted confirmation sends once; failed fresh request retries accepted criteria`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const requests: ShoppingRequest[] = []
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route(endpoint, async route => {
      const request = route.request().postDataJSON() as ShoppingRequest
      requests.push(request)
      if (requests.length === 2) {
        await gate
        await route.fulfill({ status: 503, json: { error: { code: 'service_unavailable', message: 'private backend detail', details: [] } } })
      } else await route.fulfill({ json: associated(requests.length === 1 ? journeyFixture : acceptedJourneyFixture, request) })
    })
    await page.goto('/')
    await search(page)
    await reviewFirst(page)
    await page.getByRole('checkbox', { name: /^مقایسهٔ/ }).check()
    await page.getByRole('button', { name: 'مرور و تأیید تغییرها' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('checkbox').check()
    await dialog.getByRole('button', { name: 'پذیرش و جست‌وجوی تازه' }).evaluate((node: HTMLButtonElement) => { node.click(); node.click() })
    await expect(page.getByRole('status')).toContainText('در حال بررسی')
    await expect(page.getByRole('article')).toHaveCount(0)
    await expect(dialog).not.toBeVisible()
    await expect(page.locator('.comparison-count')).toHaveText('۰')
    expect(requests).toHaveLength(2)
    expect(requests[1]!.request_id).toBe(requests[0]!.request_id)
    expect(requests[1]!.revision).toBe(requests[0]!.revision! + 1)
    expect(requests[1]!.criteria?.max_budget).toBe(journeyFixture.result.suggestions[0]!.relaxed_constraints.max_budget)
    release()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).not.toContainText('private backend detail')
    await page.getByRole('button', { name: 'تلاش دوباره' }).click()
    await expect(page.getByRole('article')).toHaveCount(1)
    expect(requests).toHaveLength(3)
    expect(requests[2]).toEqual(requests[1])
    await page.getByRole('button', { name: 'ویرایش معیارها' }).click()
    await expect(page.getByLabel('حداکثر بودجه', { exact: true })).toHaveValue(acceptedJourneyFixture.result.original_constraints.max_budget)
    await page.getByLabel('نام کالا', { exact: true }).fill('معیار تازه')
    await expect(page.getByRole('article')).toHaveCount(0)
    await page.goBack()
    await expect(page.getByRole('button', { name: 'مرور و تأیید تغییرها' })).toHaveCount(0)
  })
}

for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]] as const) {
  test(`${name}: real disposable HTTP alternative acceptance and checklist`, async ({ page }, info) => {
    test.skip(!process.env.STORE_SCOUT_LIVE_API, 'Requires the disposable API and VITE_API_BASE_URL')
    await page.setViewportSize({ width, height })
    const responses: { status: number; body: JourneyRecommendations }[] = []
    page.on('response', async response => { if (response.url().includes('/api/v1/journey/recommendations') && response.request().method() === 'POST') responses.push({ status: response.status(), body: await response.json() }) })
    await page.goto('/')
    await page.getByLabel('نام کالا', { exact: true }).fill('گوشی سامسونگ')
    await page.getByLabel('حداکثر بودجه', { exact: true }).fill('180000000')
    await page.getByLabel('واحد بودجه').selectOption('IRR')
    await page.getByLabel('عرض جغرافیایی محل انتخابی').fill('35.7')
    await page.getByLabel('طول جغرافیایی محل انتخابی').fill('51.4')
    await page.getByLabel('شعاع جست‌وجو (کیلومتر، اختیاری)').fill('5')
    await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
    await page.getByRole('link', { name: /دیدن جایگزین‌ها/ }).click()
    await page.screenshot({ path: info.outputPath(`stage2-live-alternatives-${name}.png`), fullPage: true })
    await page.getByRole('link', { name: 'بررسی تغییرهای این جایگزین' }).first().click()
    await page.getByRole('button', { name: 'مرور و تأیید تغییرها' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('checkbox').check()
    await dialog.getByRole('button', { name: 'پذیرش و جست‌وجوی تازه' }).click()
    await expect(page.getByRole('article').first()).toBeVisible()
    await expect.poll(() => responses.length).toBe(2)
    expect(responses.map(value => value.status)).toEqual([200, 200])
    expect(responses[1]!.body.state.revision).toBe(responses[0]!.body.state.revision! + 1)
    expect(responses[1]!.body.result.original_constraints).toEqual(responses[0]!.body.result.suggestions[0]!.relaxed_constraints)
    await page.getByRole('article').first().getByRole('link', { name: 'چک‌لیست پیش از مراجعه' }).click()
    await expect(page.getByRole('checkbox', { name: /^یادآوری شخصی:/ }).first()).toBeVisible()
    await page.screenshot({ path: info.outputPath(`stage2-live-checklist-${name}.png`), fullPage: true })
    expect(responses).toHaveLength(2)
  })
}
