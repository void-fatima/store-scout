import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { JourneyRecommendations, ProductDetail } from '../src/contracts'
import { acceptedJourneyFixture, journeyFixture, productDetailFixture } from '../src/test/fixtures/contracts'

const viewports = [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844], ['narrow', 360, 844]] as const
const labels = { specs: 'مشخصات کالا', fit: 'تناسب با نیاز من', purchase: 'قبل از خرید بررسی کن' }
async function search(page: Page, scenario: JourneyRecommendations) {
  const c = scenario.result.original_constraints
  await page.getByLabel('نام کالا', { exact: true }).fill(c.query)
  await page.getByLabel('حداکثر بودجه', { exact: true }).fill(c.max_budget)
  await page.getByLabel('واحد بودجه').selectOption(c.price_unit)
  await page.getByLabel('عرض جغرافیایی محل انتخابی').fill(String(c.latitude))
  await page.getByLabel('طول جغرافیایی محل انتخابی').fill(String(c.longitude))
  if (c.max_distance_km != null) await page.getByLabel('شعاع جست‌وجو (کیلومتر، اختیاری)').fill(String(c.max_distance_km))
  await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
}
async function inspect(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  expect(await page.locator('[id]').evaluateAll(nodes => {
    const ids = nodes.map(node => node.id)
    return ids.filter((id, index) => ids.indexOf(id) !== index)
  })).toEqual([])
  for (const target of await page.locator('.product-tabs button, .personal-reminder, .product-selected-offer .compare-choice, .product-purchase-review a').all()) {
    if (!await target.isVisible()) continue
    const box = await target.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect(box?.width).toBeGreaterThanOrEqual(44)
  }
}
async function intercepted(page: Page, scenario: JourneyRecommendations, failSpecs = false) {
  let posts = 0
  let gets = 0
  await page.route('**/api/v1/journey/recommendations', async route => {
    posts++
    const request = route.request().postDataJSON()
    const value = structuredClone(scenario)
    value.state.request_id = request.request_id
    value.state.revision = request.revision
    await route.fulfill({ json: value })
  })
  await page.route('**/api/v1/catalog/products/*', async route => {
    gets++
    if (failSpecs && gets === 1) {
      await route.fulfill({ status: 503, json: { error: { code: 'catalog_unavailable', message: 'private', details: [] } } })
      return
    }
    const id = decodeURIComponent(route.request().url().split('/').pop()!)
    const products = [...scenario.result.original.recommendations, ...scenario.result.suggestions.map(item => item.result)]
    const product = products.find(item => item.product_id === id)!.candidate.product
    await route.fulfill({ json: { context: scenario.result.original.context, item: { ...product, specs: productDetailFixture.item.specs } } })
  })
  return { posts: () => posts, gets: () => gets }
}

for (const [name, width, height] of viewports) for (const alternative of [false, true]) {
  const source = alternative ? 'alternative' : 'original'
  test(`${name}: intercepted ${source} tabs keep one GET, canonical pending plan, RTL keys and return context`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    const scenario = alternative ? journeyFixture : acceptedJourneyFixture
    const traffic = await intercepted(page, scenario)
    await page.goto('/')
    await search(page, scenario)
    if (alternative) await page.getByRole('link', { name: /دیدن جایگزین‌ها/ }).click()
    const card = page.getByRole('article').first()
    const entry = alternative ? scenario.result.suggestions[0]!.result : scenario.result.original.recommendations[0]!
    const plan = alternative ? scenario.result.suggestions[0]!.verification : scenario.result.original_verification.find(item => item.offer_id === entry.offer_id)!
    await card.getByRole('checkbox').check()
    await card.getByRole('link', { name: labels.specs }).click()
    await expect(page.locator('.spec-records')).toContainText('ساختگی')
    const header = await page.locator('.product-record-heading').elementHandle()
    const selected = page.getByRole('region', { name: 'آفر انتخاب‌شده و شرایط فروش' })
    await expect(selected).toContainText(entry.offer_id)
    await expect(selected.getByRole('checkbox')).toBeChecked()
    await page.evaluate(() => document.fonts.ready)
    await inspect(page, width)
    await page.screenshot({ path: info.outputPath(`stage3b-${source}-specs-${name}.png`), fullPage: true })
    const specs = page.getByRole('tab', { name: labels.specs })
    const fit = page.getByRole('tab', { name: labels.fit })
    const purchase = page.getByRole('tab', { name: labels.purchase })
    await expect(page.getByRole('tab')).toHaveCount(3)
    await specs.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(fit).toHaveAttribute('aria-selected', 'true')
    await expect(fit).toBeFocused()
    const fitPanel = page.getByRole('tabpanel', { name: labels.fit })
    await expect(fitPanel).toHaveAttribute('id', (await fit.getAttribute('aria-controls'))!)
    await expect(fitPanel.getByRole('heading', { name: alternative ? 'معیارهای پیشنهادیِ مبنای این جایگزین' : 'معیارهای ارسال‌شدهٔ این جست‌وجو' })).toBeVisible()
    for (const reason of entry.explanation_reasons) await expect(fitPanel.getByText(reason.message, { exact: true })).toBeVisible()
    for (const limitation of entry.data_limitations) await expect(fitPanel.getByText(limitation.message, { exact: true })).toBeVisible()
    await expect(fitPanel).toContainText('اطلاعات کافی برای ارزیابی فنی')
    if (alternative) await expect(fitPanel.getByRole('link', { name: 'بررسی و پذیرش صریح تغییرهای جایگزین' })).toHaveAttribute('href', /#alternative\//)
    await inspect(page, width)
    await page.screenshot({ path: info.outputPath(`stage3b-${source}-fit-${name}.png`), fullPage: true })
    await page.keyboard.press('ArrowLeft')
    await expect(purchase).toHaveAttribute('aria-selected', 'true')
    await expect(purchase).toBeFocused()
    const purchasePanel = page.getByRole('tabpanel', { name: labels.purchase })
    const reminders = purchasePanel.getByRole('checkbox', { name: /^یادآوری شخصی:/ })
    await expect(reminders).toHaveCount(plan.checklist.length)
    await expect(purchasePanel.getByText('در انتظار بررسی', { exact: true })).toHaveCount(plan.checklist.length)
    await reminders.first().check()
    await expect(purchasePanel.getByText('در انتظار بررسی', { exact: true })).toHaveCount(plan.checklist.length)
    await expect(purchasePanel).toContainText('تماسی با فروشنده انجام نشده است')
    await inspect(page, width)
    await page.screenshot({ path: info.outputPath(`stage3b-${source}-purchase-${name}.png`), fullPage: true })
    expect(await header!.evaluate(node => node.isConnected)).toBe(true)
    await page.goBack()
    await expect(fit).toBeFocused()
    await expect(fit).toHaveAttribute('aria-selected', 'true')
    await page.goForward()
    await expect(purchase).toBeFocused()
    await expect(reminders.first()).not.toBeChecked()
    await page.keyboard.press('Home')
    await expect(specs).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(purchase).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(specs).toBeFocused()
    await page.keyboard.press('End')
    await expect(purchase).toBeFocused()
    expect(traffic.gets()).toBe(1)
    expect(traffic.posts()).toBe(1)
    await expect(selected.getByRole('checkbox')).toBeChecked()
    await purchasePanel.getByRole('link', { name: 'باز کردن چک‌لیست مستقل' }).click()
    await expect(page.getByRole('heading', { name: 'چک‌لیست پیش از مراجعه' })).toBeFocused()
    await expect(page.getByRole('checkbox', { name: /^یادآوری شخصی:/ })).toHaveCount(plan.checklist.length)
    await page.getByRole('article').getByRole('link', { name: labels.specs }).click()
    await expect(page.getByRole('heading', { name: 'جزئیات کالای ثبت‌شده' })).toBeFocused()
    await page.getByRole('link', { name: 'بازگشت به چک‌لیست', exact: true }).click()
    await expect(page.getByRole('article').getByRole('link', { name: labels.specs })).toBeFocused()
    expect(traffic.gets()).toBe(2) // Leaving the detail route starts a fresh local fetch.
    expect(traffic.posts()).toBe(1)
  })
}

test('intercepted specs failure leaves fit and controller-owned purchase usable; only explicit retry GETs again', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 844 })
  const traffic = await intercepted(page, acceptedJourneyFixture, true)
  await page.goto('/')
  await search(page, acceptedJourneyFixture)
  await page.getByRole('article').first().getByRole('link', { name: labels.specs }).click()
  await expect(page.getByRole('alert')).toContainText('موقتاً')
  await page.getByRole('tab', { name: labels.fit }).click()
  await expect(page.getByRole('tabpanel', { name: labels.fit })).toContainText(acceptedJourneyFixture.result.original.recommendations[0]!.explanation_reasons[0]!.message)
  await page.getByRole('tab', { name: labels.purchase }).click()
  await expect(page.getByRole('checkbox', { name: /^یادآوری شخصی:/ }).first()).toBeVisible()
  await expect(page.getByRole('tab', { name: labels.purchase })).toBeFocused()
  expect(traffic.gets()).toBe(1)
  expect(traffic.posts()).toBe(1)
  await inspect(page, 360)
  await page.screenshot({ path: info.outputPath('stage3b-purchase-with-specs-failure-narrow.png'), fullPage: true })
  await page.getByRole('tab', { name: labels.specs }).click()
  await page.getByRole('button', { name: 'تلاش دوباره برای مشخصات' }).click()
  await expect(page.locator('.spec-records')).toContainText('ساختگی')
  expect(traffic.gets()).toBe(2)
  expect(traffic.posts()).toBe(1)
})

for (const [name, width, height] of [viewports[0], viewports[2]]) {
  test(`${name}: actual sample HTTP keeps all tabs on one GET and POST for original and unaccepted alternative`, async ({ page }, info) => {
    test.skip(!process.env.STORE_SCOUT_LIVE_API, 'Requires the disposable sample API and VITE_API_BASE_URL')
    await page.setViewportSize({ width, height })
    let gets = 0
    let posts = 0
    page.on('request', request => {
      if (request.method() === 'GET' && request.url().includes('/catalog/products/')) gets++
      if (request.method() === 'POST' && request.url().includes('/journey/recommendations')) posts++
    })
    // These requests are actual HTTP. No route interception is installed.
    await page.goto('/')
    for (const [index, budget] of ['180000000', '200000000'].entries()) {
      const alternative = index === 0
      const source = alternative ? 'alternative' : 'original'
      if (index) await page.evaluate(() => { window.location.hash = '#edit-search' })
      await page.getByLabel('نام کالا', { exact: true }).fill('گوشی سامسونگ')
      await page.getByLabel('حداکثر بودجه', { exact: true }).fill(budget)
      await page.getByLabel('واحد بودجه').selectOption('IRR')
      await page.getByLabel('عرض جغرافیایی محل انتخابی').fill('35.7')
      await page.getByLabel('طول جغرافیایی محل انتخابی').fill('51.4')
      await page.getByLabel('شعاع جست‌وجو (کیلومتر، اختیاری)').fill('5')
      const pendingSearch = page.waitForResponse(response => response.url().includes('/journey/recommendations') && response.request().method() === 'POST')
      await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
      const response = await pendingSearch
      expect(response.status()).toBe(200)
      const journey: JourneyRecommendations = await response.json()
      if (alternative) await page.getByRole('link', { name: /دیدن جایگزین‌ها/ }).click()
      const entry = alternative ? journey.result.suggestions[0]!.result : journey.result.original.recommendations[0]!
      const plan = alternative ? journey.result.suggestions[0]!.verification : journey.result.original_verification.find(item => item.offer_id === entry.offer_id)!
      await page.getByRole('article').first().getByRole('checkbox').check()
      const pendingGet = page.waitForResponse(result => result.url().includes('/catalog/products/') && result.request().method() === 'GET')
      await page.getByRole('article').first().getByRole('link', { name: labels.specs }).click()
      const productResponse = await pendingGet
      expect(productResponse.status()).toBe(200)
      const product: ProductDetail = await productResponse.json()
      expect(product.item.product_id).toBe(entry.product_id)
      expect(product.context.dataset).toEqual(journey.result.original.context.dataset)
      await expect(page.locator('.spec-records')).toContainText('ساختگی')
      await page.getByRole('tab', { name: labels.fit }).click()
      const fit = page.getByRole('tabpanel', { name: labels.fit })
      await expect(fit).toContainText(entry.explanation_reasons[0]!.message)
      await inspect(page, width)
      await page.screenshot({ path: info.outputPath(`stage3b-live-${source}-fit-${name}.png`), fullPage: true })
      await page.getByRole('tab', { name: labels.purchase }).click()
      const purchase = page.getByRole('tabpanel', { name: labels.purchase })
      await expect(purchase.getByRole('checkbox', { name: /^یادآوری شخصی:/ })).toHaveCount(plan.checklist.length)
      await expect(purchase.getByText('در انتظار بررسی', { exact: true })).toHaveCount(plan.checklist.length)
      expect(plan.contact_attempted).toBe(false)
      await expect(page.getByRole('tab', { name: labels.purchase })).toBeFocused()
      await inspect(page, width)
      await page.screenshot({ path: info.outputPath(`stage3b-live-${source}-purchase-${name}.png`), fullPage: true })
      await page.getByRole('tab', { name: labels.specs }).click()
      await expect(page.locator('.spec-records')).toContainText('ساختگی')
      await expect(page.getByRole('checkbox', { name: /^مقایسهٔ/ })).toBeChecked()
      expect(gets).toBe(index + 1)
      expect(posts).toBe(index + 1)
    }
  })
}
