import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { acceptedJourneyFixture, journeyFixture } from '../src/test/fixtures/contracts'

const endpoint = '**/api/v1/journey/recommendations'
async function fillSearch(page: Page, budget = '19000000') {
  await page.getByLabel('نام کالا', { exact: true }).fill('گوشی')
  await page.getByLabel('حداکثر بودجه', { exact: true }).fill(budget)
  await page.getByLabel('واحد بودجه').selectOption('TOMAN')
  await page.getByLabel('عرض جغرافیایی محل انتخابی').fill('35.7')
  await page.getByLabel('طول جغرافیایی محل انتخابی').fill('51.4')
}
async function noOverflow(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
}
async function accessible(page: Page) {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
}

for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844], ['narrow', 360, 844]] as const) {
  test(`${name}: intercepted results preserve order, explanation, keyboard comparison and edit search`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    const requests: unknown[] = []
    // Explicit transport scenario: duplicate canonical offer facts with distinct IDs
    // exercise the three-card layout. This is not evidence of real API ranking.
    const scenario = structuredClone(acceptedJourneyFixture)
    const result = scenario.result.original.recommendations[0]!
    scenario.result.original.recommendations = ['z-offer', 'a-offer', 'm-offer'].map(offerId => {
      const copy = structuredClone(result)
      copy.offer_id = copy.candidate.offer_id = offerId
      return copy
    })
    await page.route(endpoint, async route => {
      const request = route.request().postDataJSON()
      requests.push(request)
      const value = structuredClone(scenario)
      value.state.request_id = request.request_id
      value.state.revision = request.revision
      await route.fulfill({ json: value })
    })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/')
    await fillSearch(page)
    await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
    await expect(page.getByRole('heading', { name: 'پیشنهادهای مناسب تو' })).toBeFocused()
    await page.evaluate(() => document.fonts.ready)
    const cards = page.getByRole('article')
    await expect(cards).toHaveCount(3)
    await expect(page.locator('.data-provenance, .provenance-content')).toHaveCount(0)
    await expect(page.locator('.recommendation-panel > .source-badge')).toHaveCount(1)
    await expect(page.locator('.recommendation-panel > :last-child')).toHaveClass('offer-grid')
    expect(await cards.getByRole('checkbox').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')?.split('آفر ')[1]))).toEqual(['z-offer', 'a-offer', 'm-offer'])
    await cards.nth(0).getByRole('checkbox').focus()
    await page.keyboard.press('Space')
    await expect(cards.nth(0).getByRole('checkbox')).toBeChecked()
    await expect(page.locator('.comparison-count')).toHaveText('۱')
    await expect(page.locator('.recommendation-panel > :last-child')).toHaveClass('comparison-tray')
    await noOverflow(page, width)
    await accessible(page)
    await page.screenshot({ path: info.outputPath(`stage-results-${name}.png`), fullPage: true })
    await cards.nth(0).locator('.offer-reason summary').focus()
    await page.keyboard.press('Enter')
    await expect(cards.nth(0).getByText(result.explanation_reasons[0]!.message)).toBeVisible()
    await noOverflow(page, width)
    await cards.nth(0).getByRole('link', { name: 'دلیل این پیشنهاد' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'چرا این پیشنهاد برای تو مناسب است؟' })).toBeFocused()
    await expect(page.locator('.data-provenance')).toHaveCount(1)
    const explanation = page.getByRole('region', { name: 'انتخابی با دلیل روشن' })
    for (const reason of result.explanation_reasons) await expect(explanation.getByText(reason.message)).toBeVisible()
    for (const limitation of result.data_limitations) await expect(explanation.getByText(limitation.message)).toBeVisible()
    await page.getByText('اطلاعات ثبت‌شده و شناسه‌های این آفر').click()
    await noOverflow(page, width)
    await accessible(page)
    await page.screenshot({ path: info.outputPath(`stage-explanation-${name}.png`), fullPage: true })
    await page.goBack()
    await expect(cards.nth(0).getByRole('link', { name: 'دلیل این پیشنهاد' })).toBeFocused()
    await expect(page.locator('.data-provenance, .provenance-content')).toHaveCount(0)
    await page.getByRole('link', { name: 'مقایسهٔ گزینه‌ها' }).click()
    await expect(page.getByRole('region', { name: 'مقایسهٔ خرید' })).toBeFocused()
    await expect(page.getByRole('table')).toBeVisible()
    await page.getByRole('button', { name: /حذف .*z-offer/ }).click()
    await page.getByRole('link', { name: 'بازگشت به جست‌وجو' }).click()
    await expect(cards.nth(0).getByRole('checkbox')).not.toBeChecked()
    expect(requests).toHaveLength(1)
    await page.getByRole('button', { name: 'ویرایش معیارها' }).click()
    await expect(page.getByLabel('نام کالا', { exact: true })).toBeFocused()
    await expect(page.getByLabel('حداکثر بودجه', { exact: true })).toHaveValue('19000000')
    await page.getByLabel('نام کالا', { exact: true }).fill('گوشی جدید')
    await expect(cards).toHaveCount(0)
    await expect(page.locator('.comparison-count')).toHaveText('۰')
    expect(requests).toHaveLength(1)
    expect(errors).toEqual([])
  })
}

for (const [name, width] of [['desktop', 1440], ['mobile', 390]] as const) {
  test(`${name}: intercepted loading, error/retry and empty states`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const requests: { request_id: string; revision: number }[] = []
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route(endpoint, async route => {
      requests.push(route.request().postDataJSON())
      if (requests.length === 1) {
        await gate
        await route.fulfill({ status: 503, json: { error: { code: 'service_unavailable', message: 'hidden server detail', details: [] } } })
      } else {
        const value = structuredClone(journeyFixture)
        const request = requests.at(-1)!
        value.state.request_id = request.request_id
        value.state.revision = request.revision
        await route.fulfill({ json: value })
      }
    })
    await page.goto('/')
    await fillSearch(page, '17000000.123456789')
    await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
    await expect(page.getByRole('status')).toHaveText('در حال بررسی رکوردهای ثبت‌شده…')
    await expect(page.getByRole('article')).toHaveCount(0)
    await expect(page.locator('.skeleton-card')).toHaveCount(3)
    await page.screenshot({ path: info.outputPath(`stage-loading-${name}.png`), fullPage: true })
    await noOverflow(page, width)
    await accessible(page)
    release()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).not.toContainText('hidden server detail')
    await page.screenshot({ path: info.outputPath(`stage-error-${name}.png`), fullPage: true })
    await noOverflow(page, width)
    await accessible(page)
    await page.getByRole('button', { name: 'تلاش دوباره' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'در این جست‌وجو، گزینهٔ مناسبی پیدا نشد' })).toBeVisible()
    await expect(page.locator('.data-provenance, .provenance-content')).toHaveCount(0)
    await expect(page.locator('.recommendation-panel > :last-child')).toHaveClass('alternatives-callout')
    await expect(page.getByRole('article')).toHaveCount(0)
    expect(requests).toHaveLength(2)
    expect(requests[1]).toEqual(requests[0])
    await page.screenshot({ path: info.outputPath(`stage-empty-${name}.png`), fullPage: true })
    await noOverflow(page, width)
    await accessible(page)
    await page.getByRole('button', { name: 'ویرایش معیارها' }).first().click()
    await expect(page.getByLabel('نام کالا', { exact: true })).toBeFocused()
    await expect(page.getByLabel('حداکثر بودجه', { exact: true })).toHaveValue('17000000.123456789')
  })
}

for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]] as const) {
test(`${name}: disposable API real browser search, explanation and controlled comparison over HTTP`, async ({ page }, info) => {
  test.skip(!process.env.STORE_SCOUT_LIVE_API, 'Opt in with VITE_API_BASE_URL and STORE_SCOUT_LIVE_API pointing to the disposable API')
  const responses: number[] = []
  page.on('response', response => { if (response.url().includes('/api/v1/journey/recommendations')) responses.push(response.status()) })
  await page.setViewportSize({ width, height })
  await page.goto('/')
  await fillSearch(page, '25000000')
  await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
  await expect(page.getByRole('article').first()).toBeVisible()
  await expect(page.getByText('داده‌های نمونه و ساختگی', { exact: false }).first()).toBeVisible()
  await page.getByRole('article').first().getByRole('checkbox').check()
  await noOverflow(page, width)
  await page.screenshot({ path: info.outputPath(`stage-live-http-results-${name}.png`), fullPage: true })
  await page.getByRole('article').first().getByRole('link', { name: 'دلیل این پیشنهاد' }).click()
  await expect(page.getByRole('region', { name: 'انتخابی با دلیل روشن' })).toBeVisible()
  await noOverflow(page, width)
  await page.screenshot({ path: info.outputPath(`stage-live-http-explanation-${name}.png`), fullPage: true })
  await page.getByRole('link', { name: 'مقایسهٔ گزینه‌ها' }).click()
  await expect(page.getByRole('table')).toBeVisible()
  expect(responses).toEqual([200])
})
}

test('intercepted long records wrap, unknown prices stay unknown, and broken media uses a neutral placeholder', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await page.route(endpoint, async route => {
    const value = structuredClone(acceptedJourneyFixture)
    const request = route.request().postDataJSON()
    value.state.request_id = request.request_id
    value.state.revision = request.revision
    const result = value.result.original.recommendations[0]!
    result.candidate.price_toman = null
    result.candidate.product.persian_title = 'عنوان‌طولانی'.repeat(30)
    result.candidate.shop.name = 'فروشگاه‌ثبت‌شده'.repeat(20)
    result.candidate.product.image_urls = ['/missing-recorded-image.png']
    result.offer_id = result.candidate.offer_id = 'long-offer-'.repeat(18)
    await route.fulfill({ json: value })
  })
  await page.goto('/')
  await fillSearch(page)
  await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
  await expect(page.getByRole('article').locator('.offer-price strong')).toHaveText('نامشخص')
  await expect(page.getByRole('img', { name: 'تصویر ثبت‌شدهٔ کالا در دسترس نیست' })).toBeVisible()
  await noOverflow(page, 360)
  await page.getByRole('link', { name: 'دلیل این پیشنهاد' }).click()
  await page.getByText('اطلاعات ثبت‌شده و شناسه‌های این آفر').click()
  await noOverflow(page, 360)
})
