import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { acceptedJourneyFixture, journeyFixture } from '../src/test/fixtures/contracts'
import type { JourneyRecommendations, ProductDetail } from '../src/contracts'

const endpoint = '**/api/v1/journey/recommendations'
const productEndpoint = '**/api/v1/catalog/products/*'
const viewports = [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844], ['narrow', 360, 844]] as const
async function search(page: Page, scenario: JourneyRecommendations) {
  const criteria = scenario.result.original_constraints
  await page.getByLabel('نام کالا', { exact: true }).fill(criteria.query)
  await page.getByLabel('حداکثر بودجه', { exact: true }).fill(criteria.max_budget)
  await page.getByLabel('واحد بودجه').selectOption(criteria.price_unit)
  await page.getByLabel('عرض جغرافیایی محل انتخابی').fill(String(criteria.latitude))
  await page.getByLabel('طول جغرافیایی محل انتخابی').fill(String(criteria.longitude))
  if (criteria.max_distance_km != null) await page.getByLabel('شعاع جست‌وجو (کیلومتر، اختیاری)').fill(String(criteria.max_distance_km))
  await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
}
async function interceptJourney(page: Page, scenario: JourneyRecommendations) {
  let posts = 0
  await page.route(endpoint, async route => {
    posts++
    const request = route.request().postDataJSON()
    const value = structuredClone(scenario)
    value.state.request_id = request.request_id
    value.state.revision = request.revision
    await route.fulfill({ json: value })
  })
  return () => posts
}
function detail(scenario: JourneyRecommendations, productId: string): ProductDetail {
  const results = [...scenario.result.original.recommendations, ...scenario.result.suggestions.map(item => item.result)]
  const product = results.find(item => item.product_id === productId)!.candidate.product
  return { context: scenario.result.original.context, item: { ...product, specs: [
    { section: 'حافظه', key: 'ظرفیت ثبت‌شده', value: 0, unit: 'GB', enabled: false },
    { unknown: { values: [null, '', [], {}, '<img src=x onerror=alert(1)>', 'very-long-recorded-value-'.repeat(12)] } },
    { section: 'حافظه', key: 'ظرفیت ثبت‌شده', value: 0, unit: 'GB', enabled: false },
  ] } }
}
async function accessible(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  for (const target of await page.locator('.product-detail-grid .compare-choice, .product-detail-grid a, .detail-back').all()) {
    // Inactive tab panels remain mounted to retain fetch state; inspect visible controls.
    if (!await target.isVisible()) continue
    const box = await target.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }
}

for (const [name, width, height] of viewports) {
  test(`${name}: intercepted recorded details retain original/alternative offer, comparison, focus and safe JSON`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    const scenario = structuredClone(acceptedJourneyFixture)
    // Combine existing canonical entries only for intercepted navigation coverage;
    // this scenario does not establish backend ranking/constraint satisfaction.
    scenario.result.suggestions = structuredClone(journeyFixture.result.suggestions)
    const posts = await interceptJourney(page, scenario)
    let gets = 0
    await page.route(productEndpoint, async route => {
      gets++
      await route.fulfill({ json: detail(scenario, decodeURIComponent(route.request().url().split('/').pop()!)) })
    })
    await page.goto('/')
    await search(page, scenario)
    const card = page.getByRole('article').first()
    await card.getByRole('checkbox').check()
    await card.getByRole('link', { name: 'مشخصات کالا' }).focus()
    await page.keyboard.press('Enter')
    const heading = page.getByRole('heading', { name: 'جزئیات کالای ثبت‌شده' })
    await expect(heading).toBeFocused()
    await expect(page.getByText('false', { exact: true })).toHaveCount(2)
    await expect(page.getByText('0', { exact: true })).toHaveCount(2)
    await expect(page.getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible()
    expect(await page.locator('img[src="x"], script:not([type="module"])').count()).toBe(0)
    await expect(page.getByRole('checkbox')).toBeChecked()
    const seller = page.getByRole('region', { name: 'آفر انتخاب‌شده و شرایط فروش' })
    await expect(seller).toContainText(scenario.result.original.recommendations[0]!.offer_id)
    await expect(seller).toContainText('موجودی تأیید نشده')
    await page.evaluate(() => document.fonts.ready)
    await accessible(page, width)
    await page.screenshot({ path: info.outputPath(`stage3a-product-${name}.png`), fullPage: true })
    await page.getByRole('link', { name: 'بازگشت به پیشنهادها', exact: true }).click()
    await expect(card.getByRole('link', { name: 'مشخصات کالا' })).toBeFocused()
    await expect(card.getByRole('checkbox')).toBeChecked()
    await page.getByRole('link', { name: /دیدن جایگزین‌ها/ }).click()
    const alternativeIndex = scenario.result.suggestions.findIndex(item => !scenario.result.original.recommendations.some(original => original.offer_id === item.result.offer_id))
    expect(alternativeIndex).toBeGreaterThanOrEqual(0)
    const alt = page.getByRole('article').nth(alternativeIndex)
    const altLabel = await alt.getByRole('checkbox').getAttribute('aria-label')
    await alt.getByRole('link', { name: 'مشخصات کالا' }).click()
    await expect(heading).toBeFocused()
    await expect(page.getByText('این کالا یک پیشنهاد جایگزین است؛ دیدن مشخصات، پذیرش تغییر معیارها نیست.')).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveAttribute('aria-label', altLabel!)
    await page.getByRole('checkbox').focus()
    await page.keyboard.press('Space')
    await expect(page.getByRole('checkbox')).toBeChecked()
    await page.getByRole('link', { name: 'مقایسهٔ گزینه‌ها' }).click()
    await expect(page.getByRole('columnheader')).toHaveCount(3)
    await page.goBack()
    await expect(heading).toBeFocused()
    await expect(page.getByRole('checkbox')).toBeChecked()
    await page.getByRole('checkbox').uncheck()
    await page.getByRole('link', { name: 'بازگشت به جایگزین‌ها', exact: true }).click()
    await expect(alt.getByRole('link', { name: 'مشخصات کالا' })).toBeFocused()
    await expect(alt.getByRole('checkbox')).not.toBeChecked()
    await expect(page.locator('#criteria-budget')).toHaveValue(scenario.result.original_constraints.max_budget)
    expect(posts()).toBe(1)
    expect(gets).toBe(3)
  })
}

test('intercepted 404/503, invalid and incompatible details retry to empty specs without another POST', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const scenario = acceptedJourneyFixture
  const posts = await interceptJourney(page, scenario)
  let gets = 0
  await page.route(productEndpoint, async route => {
    const value = detail(scenario, decodeURIComponent(route.request().url().split('/').pop()!))
    gets++
    if (gets <= 2) await route.fulfill({ status: gets === 1 ? 404 : 503, json: { error: { code: 'catalog_unavailable', message: 'private error', details: [] } } })
    else if (gets === 3) await route.fulfill({ json: { ...value, item: { ...value.item, specs: null } } })
    else if (gets === 4) await route.fulfill({ json: { ...value, context: { ...value.context, dataset: { ...value.context.dataset, source_sha256: 'different' } } } })
    else await route.fulfill({ json: { ...value, item: { ...value.item, specs: [] } } })
  })
  await page.goto('/')
  await search(page, scenario)
  await page.getByRole('article').first().getByRole('checkbox').check()
  await page.getByRole('link', { name: 'مشخصات کالا' }).first().click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('پیدا نشد')
  await page.screenshot({ path: info.outputPath('stage3a-not-found-mobile.png'), fullPage: true })
  for (const message of ['موقتاً', 'پاسخ معتبر', 'سازگار نیست']) {
    await page.getByRole('button', { name: 'تلاش دوباره برای مشخصات' }).click()
    await expect(alert).toContainText(message)
    await expect(alert).not.toContainText('private')
    await expect(page.getByRole('checkbox')).toBeChecked()
  }
  await page.getByRole('button', { name: 'تلاش دوباره برای مشخصات' }).click()
  await expect(page.getByText('مشخصاتی در این رکورد ثبت نشده است.')).toBeVisible()
  await accessible(page, 390)
  await page.screenshot({ path: info.outputPath('stage3a-empty-mobile.png'), fullPage: true })
  expect(posts()).toBe(1)
  expect(gets).toBe(5)
})

test('intercepted delayed details cannot attach after switching products or editing criteria', async ({ page }, info) => {
  const scenario = journeyFixture
  const posts = await interceptJourney(page, scenario)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let releaseEdit!: () => void
  const editGate = new Promise<void>(resolve => { releaseEdit = resolve })
  let gets = 0
  await page.route(productEndpoint, async route => {
    const value = detail(scenario, decodeURIComponent(route.request().url().split('/').pop()!))
    const ordinal = ++gets
    if (ordinal === 1) await gate
    if (ordinal === 3) await editGate
    await route.fulfill({ json: { ...value, item: { ...value.item, specs: [{ value: ordinal === 1 ? 'DELAYED FIRST' : 'CURRENT SECOND' }] } } })
  })
  await page.goto('/')
  await search(page, scenario)
  await page.getByRole('link', { name: /دیدن جایگزین‌ها/ }).click()
  const cards = page.getByRole('article')
  const links = await cards.getByRole('link', { name: 'مشخصات کالا' }).evaluateAll(nodes => nodes.map(node => node.getAttribute('href')!))
  const firstProduct = links[0]!.split('/')[2]
  const second = links.find(link => link.split('/')[2] !== firstProduct)!
  expect(second).toBeTruthy()
  await cards.first().getByRole('link', { name: 'مشخصات کالا' }).click()
  await expect(page.getByText('در حال دریافت مشخصات ثبت‌شده…')).toBeVisible()
  await page.screenshot({ path: info.outputPath('stage3a-loading-desktop.png'), fullPage: true })
  await page.evaluate(hash => { window.location.hash = hash }, second)
  await expect(page.getByText('CURRENT SECOND', { exact: true })).toBeVisible()
  release()
  await expect(page.getByText('DELAYED FIRST')).toHaveCount(0)
  await page.evaluate(hash => { window.location.hash = hash }, links[0]!)
  await expect(page.getByText('در حال دریافت مشخصات ثبت‌شده…')).toBeVisible()
  await page.evaluate(() => { window.location.hash = '#edit-search' })
  await page.getByLabel('نام کالا', { exact: true }).fill('معیار ویرایش‌شده')
  releaseEdit()
  await page.evaluate(hash => { window.location.hash = hash }, links[0]!)
  await expect(page.getByRole('heading', { name: 'جزئیات کالای ثبت‌شده' })).toHaveCount(0)
  expect(posts()).toBe(1)
})

for (const [name, width, height] of [viewports[0], viewports[2]]) {
  test(`${name}: real disposable HTTP GET details for an unaccepted alternative and an original offer`, async ({ page }, info) => {
    test.skip(!process.env.STORE_SCOUT_LIVE_API, 'Requires disposable sample API and VITE_API_BASE_URL')
    await page.setViewportSize({ width, height })
    const responses: { status: number; body: ProductDetail }[] = []
    let posts = 0
    page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/journey/recommendations')) posts++ })
    page.on('response', async response => {
      if (response.request().method() === 'GET' && response.url().includes('/catalog/products/')) responses.push({ status: response.status(), body: await response.json() })
    })
    // No route interception in this test; these are actual sample API requests.
    await page.goto('/')
    await page.getByLabel('نام کالا', { exact: true }).fill('گوشی سامسونگ')
    await page.getByLabel('حداکثر بودجه', { exact: true }).fill('180000000')
    await page.getByLabel('واحد بودجه').selectOption('IRR')
    await page.getByLabel('عرض جغرافیایی محل انتخابی').fill('35.7')
    await page.getByLabel('طول جغرافیایی محل انتخابی').fill('51.4')
    await page.getByLabel('شعاع جست‌وجو (کیلومتر، اختیاری)').fill('5')
    await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
    await page.getByRole('link', { name: /دیدن جایگزین‌ها/ }).click()
    await page.getByRole('article').first().getByRole('checkbox').check()
    await page.getByRole('link', { name: 'مشخصات کالا' }).first().click()
    await expect(page.locator('.spec-records')).toContainText('ساختگی')
    await expect(page.getByRole('checkbox')).toBeChecked()
    await accessible(page, width)
    await page.screenshot({ path: info.outputPath(`stage3a-live-alternative-${name}.png`), fullPage: true })
    expect(posts).toBe(1)
    await page.getByRole('link', { name: 'بازگشت به جایگزین‌ها', exact: true }).click()
    await page.getByRole('link', { name: 'بازگشت به پیشنهادها', exact: true }).click()
    await page.getByRole('button', { name: 'ویرایش معیارها', exact: true }).first().click()
    await page.getByLabel('حداکثر بودجه', { exact: true }).fill('200000000')
    await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
    await page.getByRole('article').first().getByRole('link', { name: 'مشخصات کالا' }).click()
    await expect(page.locator('.spec-records')).toContainText('ساختگی')
    await page.screenshot({ path: info.outputPath(`stage3a-live-original-${name}.png`), fullPage: true })
    await expect.poll(() => responses.length).toBe(2)
    expect(responses.map(value => value.status)).toEqual([200, 200])
    for (const response of responses) {
      expect(response.body.context.dataset?.source_kind).toBe('sample')
      expect(response.body.item.specs).toEqual([{ section: 'نمونه', key: 'داده', value: 'ساختگی' }])
    }
    expect(posts).toBe(2)
  })
}
