import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { journeyFixture } from '../src/test/fixtures/contracts'

async function search(page: Page) {
  const criteria = journeyFixture.result.original_constraints
  await page.getByLabel('نام کالا', { exact: true }).fill(criteria.query)
  await page.getByLabel('حداکثر بودجه', { exact: true }).fill(criteria.max_budget)
  await page.getByLabel('واحد بودجه').selectOption(criteria.price_unit)
  await page.getByLabel('عرض جغرافیایی محل انتخابی').fill(String(criteria.latitude))
  await page.getByLabel('طول جغرافیایی محل انتخابی').fill(String(criteria.longitude))
  await page.getByRole('button', { name: 'دیدن پیشنهادها' }).click()
  await page.getByRole('link', { name: /دیدن جایگزین‌ها/ }).click()
}

for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 390, 844], ['narrow', 360, 844]] as const) {
  test(`${name}: intercepted comparison retains identities, controlled state, focus and contained scroll`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    let requests = 0
    await page.route('**/api/v1/journey/recommendations', async route => {
      requests += 1
      const request = route.request().postDataJSON()
      const value = structuredClone(journeyFixture)
      value.state.request_id = request.request_id
      value.state.revision = request.revision
      await route.fulfill({ json: value })
    })
    await page.goto('/')
    await search(page)
    const choices = page.getByRole('checkbox', { name: /^مقایسهٔ/ })
    await choices.nth(0).check()
    await choices.nth(1).check()
    await page.getByRole('link', { name: 'مقایسهٔ گزینه‌ها' }).click()
    const region = page.getByRole('region', { name: 'جدول مقایسهٔ آفرها' })
    await expect(page.getByRole('region', { name: 'مقایسهٔ خرید' })).toBeFocused()
    await expect(page.getByRole('columnheader')).toHaveCount(3)
    const selected = journeyFixture.result.suggestions.slice(0, 2)
    expect(await page.locator('.comparison-offer-id').allTextContents()).toEqual(selected.map(item => `آفر: ${item.result.offer_id}`))
    await expect(page.getByRole('row', { name: /^نوع نتیجه/ })).toContainText('نیازمند پذیرش تغییرهاست')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    if (width <= 768) {
      expect(await region.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true)
      await region.focus()
      await page.keyboard.press('ArrowLeft')
      await expect.poll(() => region.evaluate(node => Math.abs(node.scrollLeft))).toBeGreaterThan(0)
      await region.evaluate(node => { node.scrollLeft = 0 })
    }
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
    for (const target of await page.locator('.comparison-remove, .comparison-return-links a, .comparison-table .outline-action').all()) {
      const box = await target.boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
      expect(box?.width).toBeGreaterThanOrEqual(44)
    }
    await page.screenshot({ path: info.outputPath(`stage2-comparison-${name}.png`), fullPage: true })
    await page.getByRole('link', { name: 'چک‌لیست پیش از مراجعه' }).first().click()
    await expect(page.getByRole('heading', { name: 'چک‌لیست پیش از مراجعه' })).toBeFocused()
    await expect(page.getByRole('checkbox', { name: /^یادآوری شخصی:/ }).first()).toBeVisible()
    await page.getByRole('link', { name: 'بازگشت به جایگزین', exact: true }).click()
    await page.getByRole('link', { name: 'مقایسهٔ گزینه‌ها' }).click()
    await expect(page.getByRole('columnheader')).toHaveCount(3)
    await page.getByRole('button', { name: /^حذف / }).first().click()
    await expect(page.getByRole('button', { name: /^حذف / })).toBeFocused()
    await expect(page.getByRole('status')).toContainText('یک آفر انتخاب شده است')
    await page.screenshot({ path: info.outputPath(`stage2-comparison-single-${name}.png`), fullPage: true })
    await page.getByRole('link', { name: 'بازگشت به جایگزین‌ها' }).click()
    await expect(choices.nth(0)).not.toBeChecked()
    await expect(choices.nth(1)).toBeChecked()
    await expect(page.locator('#criteria-budget')).toHaveValue(journeyFixture.result.original_constraints.max_budget)
    await page.getByRole('link', { name: 'مقایسهٔ گزینه‌ها' }).click()
    await page.getByRole('button', { name: /^حذف / }).click()
    await expect(page.getByRole('heading', { name: 'مقایسهٔ انتخاب‌ها', exact: true })).toBeFocused()
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('status')).toContainText('هنوز انتخاب معتبری')
    await page.screenshot({ path: info.outputPath(`stage2-comparison-empty-${name}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    expect(requests).toBe(1)
  })
}

test('intercepted eleven-offer scenario keeps the ten-selection limit and wide comparison contained', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await page.route('**/api/v1/journey/recommendations', async route => {
    const value = structuredClone(journeyFixture)
    const request = route.request().postDataJSON()
    value.state.request_id = request.request_id
    value.state.revision = request.revision
    // Layout/selection stress scenario only, not evidence of actual backend offers.
    value.result.suggestions = Array.from({ length: 11 }, (_, index) => {
      const suggestion = structuredClone(journeyFixture.result.suggestions[0]!)
      suggestion.result.offer_id = suggestion.result.candidate.offer_id = suggestion.verification.offer_id = `comparison-stress-${index}`
      return suggestion
    })
    await route.fulfill({ json: value })
  })
  await page.goto('/')
  await search(page)
  const choices = page.getByRole('checkbox', { name: /^مقایسهٔ/ })
  for (let index = 0; index < 10; index++) await choices.nth(index).check()
  await expect(choices.nth(10)).toBeDisabled()
  await expect(choices.nth(0)).toBeEnabled()
  await page.getByRole('link', { name: 'مقایسهٔ گزینه‌ها' }).click()
  await expect(page.getByRole('columnheader')).toHaveCount(11)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
})
