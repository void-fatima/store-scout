import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Shop } from '../../../contracts'
import { acceptedJourneyFixture } from '../../../test/fixtures/contracts'
import '../../../styles/global.css'
import { RecordedShopLocation } from '../index'
import './preview.css'

const original = acceptedJourneyFixture.result.original
const recorded = original.recommendations[0]!.candidate.shop
const scenarios = {
  recorded: { label: 'رکورد نمونهٔ قرارداد', shop: recorded },
  zero: { label: 'مختصات صفر', shop: { ...recorded, lat: 0, lon: 0 } },
  missing: { label: 'فقط نشانی؛ مختصات ناقص', shop: { ...recorded, lat: null } },
  invalid: { label: 'مختصات خارج از محدوده', shop: { ...recorded, lat: 91 } },
  polar: { label: 'محدودیت نمایش قطب', shop: { ...recorded, lat: 90 } },
  long: { label: 'متن بلند و نامطمئن', shop: { ...recorded, name: '<script>متن ثبت‌شده، نه کد اجرایی</script>',
    address: 'نشانی‌ثبت‌شده‌با‌متن‌بلند‌بدون‌فاصله'.repeat(10) } },
} satisfies Record<string, { label: string; shop: Shop }>
type Scenario = keyof typeof scenarios

export function Preview() {
  const [scenario, setScenario] = useState<Scenario>('recorded')
  return <main className="location-preview">
    <header><p className="location-preview__eyebrow">StoreScout · پیش‌نمایش مستقل</p>
      <h1>مکان ثبت‌شده، پیش از مراجعه</h1>
      <p>نمونهٔ توسعه با دادهٔ ساختگی قرارداد؛ این صفحه به مسیر خرید متصل نیست.</p>
      <label>حالت پیش‌نمایش <select value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>
        {Object.entries(scenarios).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
      </select></label>
    </header>
    <RecordedShopLocation shop={scenarios[scenario].shop} context={original.context} />
  </main>
}

createRoot(document.getElementById('location-preview')!).render(<Preview />)
