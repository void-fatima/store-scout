import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const preview = '/src/features/location/preview/index.html'
const frameFixture = `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>قاب آزمایشی نقشه</title>
<style>body{margin:0;background:#edf7ee;color:#101b3d;font:16px Tahoma,sans-serif}main{padding:24px}button{min-width:48px;min-height:48px;margin:4px;background:white;border:1px solid #59657e;border-radius:8px}button:focus-visible{outline:3px solid #175bc2;outline-offset:3px}</style>
<main><h1 style="font-size:18px">قاب آزمایشی؛ نقشهٔ واقعی نیست</h1><p>درخواست خارجی برای این آزمون رهگیری شده است.</p>
<button type="button" aria-label="بزرگ‌نمایی آزمایشی">+</button><button type="button" aria-label="کوچک‌نمایی آزمایشی">−</button></main></html>`

async function isolateExternal(page: Page, fail = false) {
  const external: string[] = []
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.hostname === '127.0.0.1') return route.continue()
    external.push(url.href)
    if (!fail && url.origin === 'https://www.openstreetmap.org' && url.pathname === '/export/embed.html') {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: frameFixture })
    }
    return route.abort()
  })
  return external
}

async function inspect(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  for (const target of await page.locator('.recorded-shop-location a, .recorded-shop-location summary').all()) {
    if (!await target.isVisible()) continue
    const box = await target.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.width).toBeGreaterThanOrEqual(44)
  }
}

for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844], ['narrow', 360, 844]] as const) {
  test(`${name}: intercepted map, keyboard, accessible facts and provenance`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    const requests = await isolateExternal(page)
    await page.goto(preview)
    const frame = page.frameLocator('iframe')
    await expect(frame.getByRole('heading', { name: 'قاب آزمایشی؛ نقشهٔ واقعی نیست' })).toBeVisible()
    expect(requests).toHaveLength(1)
    const src = new URL(page.url())
    expect(src.port).toBe('5187')
    await page.getByLabel('حالت پیش‌نمایش').focus()
    await page.keyboard.press('Tab')
    await expect(frame.getByRole('button', { name: 'بزرگ‌نمایی آزمایشی' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(frame.getByRole('button', { name: 'کوچک‌نمایی آزمایشی' })).toBeFocused()
    await page.keyboard.press('Tab')
    const open = page.getByRole('link', { name: /باز کردن موقعیت/ })
    await expect(open).toBeFocused()
    expect(await open.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(page.getByText('منبع و محدودیت‌های مکان', { exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByText('داده‌های نمونه و ساختگی', { exact: true })).toBeVisible()
    await inspect(page, width)
    await open.focus()
    await page.screenshot({ path: info.outputPath(`recorded-location-${name}-intercepted.png`), fullPage: true })
  })
}

test('360px: address-only, zero, polar and long hostile text remain usable', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 844 })
  await isolateExternal(page)
  await page.goto(preview)
  for (const scenario of ['missing', 'invalid']) {
    await page.getByLabel('حالت پیش‌نمایش').selectOption(scenario)
    await expect(page.locator('iframe')).toHaveCount(0)
    await expect(page.getByText(/مختصات معتبر و کامل در دسترس نیست/)).toBeVisible()
    await expect(page.locator('.recorded-shop-location__facts > div').first()).not.toContainText('نشانی ثبت نشده')
    await expect(page.getByRole('link', { name: /باز کردن موقعیت/ })).toHaveCount(0)
    await inspect(page, 360)
    if (scenario === 'missing') await page.screenshot({ path: info.outputPath('recorded-location-unavailable-360.png'), fullPage: true })
  }
  await page.getByLabel('حالت پیش‌نمایش').selectOption('zero')
  await expect(page.locator('iframe')).toHaveAttribute('src', /marker=0%2C0/)
  await page.getByLabel('حالت پیش‌نمایش').selectOption('polar')
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.getByText(/عرض‌های نزدیک قطب/)).toBeVisible()
  await expect(page.getByRole('link', { name: /باز کردن موقعیت/ })).toHaveAttribute('href', /mlat=90/)
  await page.getByLabel('حالت پیش‌نمایش').selectOption('long')
  await expect(page.getByText('<script>متن ثبت‌شده، نه کد اجرایی</script>', { exact: true })).toBeVisible()
  await expect(page.locator('.recorded-shop-location script')).toHaveCount(0)
  await page.locator('iframe').scrollIntoViewIfNeeded()
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'قاب آزمایشی؛ نقشهٔ واقعی نیست' })).toBeVisible()
  await inspect(page, 360)
  await page.screenshot({ path: info.outputPath('recorded-location-long-text-360-intercepted.png'), fullPage: true })
})

test('blocked external frame leaves facts and independent link available', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 844 })
  const requests = await isolateExternal(page, true)
  await page.goto(preview)
  await expect.poll(() => requests.length).toBe(1)
  await expect(page.getByText(/اگر نقشه بارگیری نشد/)).toBeVisible()
  await expect(page.getByRole('link', { name: /باز کردن موقعیت/ })).toBeVisible()
  await expect(page.locator('.recorded-shop-location__coordinates')).toBeVisible()
  await page.getByRole('link', { name: /باز کردن موقعیت/ }).focus()
  await expect(page.getByRole('link', { name: /باز کردن موقعیت/ })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
  await page.screenshot({ path: info.outputPath('recorded-location-blocked-frame-360.png'), fullPage: true })
})
