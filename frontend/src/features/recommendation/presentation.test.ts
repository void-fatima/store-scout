import { expect, it } from 'vitest'
import { exactMoney, offerHash, parsePanelRoute } from './presentation'

it('formats exact monetary digits without floating point rounding or currency conversion', () => {
  expect(exactMoney('17000000.123456789')).toBe('۱۷٬۰۰۰٬۰۰۰٫۱۲۳۴۵۶۷۸۹')
  expect(exactMoney('9007199254740993.001')).toBe('۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳٫۰۰۱')
  expect(exactMoney('1.9000000E+7')).toBe('۱۹٬۰۰۰٬۰۰۰')
  expect(exactMoney('1E-3')).toBe('۰٫۰۰۱')
  expect(exactMoney('0')).toBe('۰')
})
it('round trips full offer identity and rejects malformed presentation links', () => {
  const key = { dataset_id: 'data/1', product_id: 'محصول ۱', offer_id: 'offer#1' }
  expect(parsePanelRoute(offerHash('explanation', key))).toEqual({ view: 'explanation', key })
  expect(parsePanelRoute('#explanation/a/b/%broken')).toBeNull()
  expect(parsePanelRoute('#checklist/a/b/c/extra')).toBeNull()
  expect(parsePanelRoute('#alternatives')).toBeNull()
})
