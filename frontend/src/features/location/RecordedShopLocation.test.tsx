import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Shop } from '../../contracts'
import { acceptedJourneyFixture } from '../../test/fixtures/contracts'
import { RecordedShopLocation } from './RecordedShopLocation'
import { mercatorLimit, recordedPosition } from './mapUrls'

const context = acceptedJourneyFixture.result.original.context
const shop: Shop = { shop_id: 'location-test', name: 'فروشگاه نمونه', address: 'نشانی ثبت‌شدهٔ نمونه', lat: 35.7, lon: 51.4 }

it('renders a labelled map and independent position link from the canonical shop', () => {
  render(<RecordedShopLocation shop={shop} context={context} />)
  expect(screen.getByText(shop.address!)).toBeInTheDocument()
  const frame = screen.getByTitle(`نقشهٔ تعاملی مکان ثبت‌شدهٔ ${shop.name}`)
  const src = new URL(frame.getAttribute('src')!)
  expect(src.origin + src.pathname).toBe('https://www.openstreetmap.org/export/embed.html')
  expect(src.searchParams.get('marker')).toBe('35.7,51.4')
  expect(src.searchParams.get('layer')).toBe('mapnik')
  const bbox = src.searchParams.get('bbox')!.split(',').map(Number)
  expect(bbox[0]).toBeLessThan(shop.lon!)
  expect(bbox[1]).toBeLessThan(shop.lat!)
  expect(bbox[2]).toBeGreaterThan(shop.lon!)
  expect(bbox[3]).toBeGreaterThan(shop.lat!)
  expect(frame).toHaveAttribute('loading', 'lazy')
  expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer')
  expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups')
  const link = screen.getByRole('link', { name: /باز کردن موقعیت/ })
  const url = new URL(link.getAttribute('href')!)
  expect(url.origin).toBe('https://www.openstreetmap.org')
  expect(url.searchParams.get('mlat')).toBe('35.7')
  expect(url.searchParams.get('mlon')).toBe('51.4')
  expect(url.hash).toBe('#map=16/35.7/51.4')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  // A cross-origin frame's load event does not prove its map or tiles succeeded.
  fireEvent.load(frame)
  expect(screen.queryByText(/با موفقیت/)).not.toBeInTheDocument()
  expect(screen.getByText(/اگر نقشه بارگیری نشد/)).toBeVisible()
})

it('accepts zero coordinates without substituting a default city', () => {
  render(<RecordedShopLocation shop={{ ...shop, lat: 0, lon: 0 }} context={context} />)
  expect(new URL(screen.getByTitle(/نقشهٔ تعاملی/).getAttribute('src')!).searchParams.get('marker')).toBe('0,0')
  expect(screen.getAllByText('0')).toHaveLength(2)
})

describe('unavailable coordinates', () => {
  it.each([
    {}, { lat: 35.7 }, { lon: 51.4 }, { lat: null, lon: null }, { lat: 0, lon: null },
    { lat: NaN, lon: 51 }, { lat: 35, lon: Infinity }, { lat: -Infinity, lon: 0 },
    { lat: 90.001, lon: 0 }, { lat: -90.001, lon: 0 }, { lat: 0, lon: 180.001 }, { lat: 0, lon: -180.001 },
    { lat: '35.7', lon: '51.4' }, { lat: '', lon: 0 }, { lat: true, lon: false },
  ])('keeps address but supplies no frame or map link for %j', coordinates => {
    // Exercise malformed runtime input as well as canonical nullable values.
    const value = { shop_id: shop.shop_id, name: shop.name, address: shop.address, ...coordinates } as unknown as Shop
    const { container } = render(<RecordedShopLocation shop={value} context={context} />)
    expect(screen.getByText(shop.address!)).toBeVisible()
    expect(screen.getByText(/مختصات معتبر و کامل در دسترس نیست/)).toBeVisible()
    expect(container.querySelector('iframe')).toBeNull()
    expect(screen.queryByRole('link', { name: /باز کردن موقعیت/ })).not.toBeInTheDocument()
  })
})

it('safely renders hostile text without adding text to external URLs or exposing contacts', () => {
  const hostile = '<img src=x onerror=alert(1)> javascript:alert(1) & <script>attack</script>'
  const { container } = render(<RecordedShopLocation shop={{ ...shop, name: hostile, address: hostile,
    contacts: [{ phone: 'secret-phone' }], website_url: 'javascript:alert(1)' }} context={{ ...context, notices: [hostile] }} />)
  expect(screen.getAllByText(hostile)).toHaveLength(3)
  expect(container.querySelector('script, img')).toBeNull()
  expect(screen.queryByText('secret-phone')).not.toBeInTheDocument()
  for (const node of container.querySelectorAll('a, iframe')) {
    const url = new URL(node.getAttribute(node.tagName === 'IFRAME' ? 'src' : 'href')!)
    expect(url.origin).toBe('https://www.openstreetmap.org')
    expect(url.href).not.toContain('attack')
  }
})

it('preserves supplied provenance and makes missing text/context explicit', () => {
  const { rerender } = render(<RecordedShopLocation shop={shop} context={context} />)
  expect(screen.getByText('داده‌های نمونه و ساختگی')).toBeInTheDocument()
  expect(screen.getByText(/پوشش داده‌های تهران محدود است/)).toBeInTheDocument()
  for (const notice of context.notices ?? []) expect(screen.getByText(notice)).toBeInTheDocument()
  rerender(<RecordedShopLocation shop={{ shop_id: 'unknown', name: ' ', address: null }} context={{}} />)
  expect(screen.getByText('نام فروشگاه ثبت نشده است')).toBeVisible()
  expect(screen.getByText('نشانی ثبت نشده است')).toBeVisible()
  expect(screen.getByText('منبع داده نامشخص')).toBeInTheDocument()
  expect(screen.getByText(/شماره‌های تماس این منبع ساختگی‌اند/)).toBeInTheDocument()
  rerender(<RecordedShopLocation shop={shop} context={{ dataset: { ...context.dataset!, source_kind: 'provided' } }} />)
  expect(screen.getByText('داده‌های واردشده؛ هویت تأیید نشده')).toBeInTheDocument()
})

it('replaces old coordinates immediately and removes an obsolete frame on invalidation', () => {
  const { rerender, container } = render(<RecordedShopLocation shop={shop} context={context} />)
  rerender(<RecordedShopLocation shop={{ ...shop, shop_id: 'next', lat: -10, lon: -20 }} context={{}} />)
  expect(new URL(screen.getByTitle(/نقشهٔ تعاملی/).getAttribute('src')!).searchParams.get('marker')).toBe('-10,-20')
  rerender(<RecordedShopLocation shop={{ shop_id: 'next', name: 'بعدی' }} context={{}} />)
  expect(container.querySelector('iframe')).toBeNull()
  expect(screen.queryByText(shop.address!)).not.toBeInTheDocument()
})

it('gives repeated instances unique accessible relationships without page IDs', () => {
  const { container } = render(<><RecordedShopLocation shop={shop} context={context} /><RecordedShopLocation shop={shop} context={context} /></>)
  const ids = [...container.querySelectorAll('[id]')].map(node => node.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const section of screen.getAllByRole('region')) {
    expect(document.getElementById(section.getAttribute('aria-labelledby')!)).toHaveTextContent('مکان ثبت‌شدهٔ فروشگاه')
  }
})

it.each([-180, 180])('keeps boundary longitude %s and ordered bounded boxes', lon => {
  const value = recordedPosition({ lat: mercatorLimit, lon })!
  expect(new URL(value.embed!).searchParams.get('marker')).toBe(`${mercatorLimit},${lon}`)
  const [west, south, east, north] = new URL(value.embed!).searchParams.get('bbox')!.split(',').map(Number) as [number, number, number, number]
  expect(west).toBeLessThan(east)
  expect(south).toBeLessThan(north)
  expect(west).toBeGreaterThanOrEqual(-180)
  expect(east).toBeLessThanOrEqual(180)
  expect(north).toBeLessThanOrEqual(mercatorLimit)
})

it.each([-90, 90])('retains valid polar latitude %s with a truthful projection limitation', lat => {
  render(<RecordedShopLocation shop={{ ...shop, lat }} context={context} />)
  expect(screen.getByText(String(lat))).toBeVisible()
  expect(screen.getByText(/عرض‌های نزدیک قطب/)).toBeVisible()
  expect(screen.queryByTitle(/نقشهٔ تعاملی/)).not.toBeInTheDocument()
  expect(new URL(screen.getByRole('link', { name: /باز کردن موقعیت/ }).getAttribute('href')!).searchParams.get('mlat')).toBe(String(lat))
})
