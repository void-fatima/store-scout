import { JourneyFlow, useJourneyController } from './journey'
import { useJourneyView } from './journey/useJourneyView'
import { Header } from './shell/Header'
import { Icon } from './shell/Icon'

export default function App() {
  const view = useJourneyView()
  const controller = useJourneyController()
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">رفتن به محتوای اصلی</a>
    <Header comparisonCount={controller.state.comparison.length} view={view} />
    <main id="main-content" className="container main-content" tabIndex={-1}>
      <JourneyFlow controller={controller} />
    </main>
    <footer id="about" className="site-footer container" tabIndex={-1}>
      <p><Icon name="info" />اطلاعات ثبت‌شده، تضمین موجودی یا قیمت فعلی نیست؛ پیش از مراجعه از فروشگاه تأیید بگیر.</p>
      <span>استوراسکاوت · انتخاب آگاهانه</span>
    </footer>
  </div>
}
