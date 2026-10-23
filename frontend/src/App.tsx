import { JourneyFlow } from './journey'
import { useJourneyView } from './journey/useJourneyView'

export default function App() {
  const view = useJourneyView()
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">رفتن به محتوای اصلی</a>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#main-content" aria-label="استوراسکاوت، خانه">
            استوراسکاوت
          </a>
          <nav aria-label="ناوبری اصلی">
            <a href="#search" aria-current={view === 'search' ? 'page' : undefined}>راهنمای خرید</a>
            <a href="#comparison" aria-current={view === 'comparison' ? 'page' : undefined}>مقایسه</a>
            <a href="#about">دربارهٔ این راهنما</a>
          </nav>
        </div>
      </header>

      <main id="main-content" className="container main-content" tabIndex={-1}>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">همراه خرید حضوری</p>
          <h1 id="page-title">با آگاهی بیشتر، برای خرید آماده شوید.</h1>
          <p className="muted">کالاها و فروشگاه‌ها را با معیارهای خود بررسی کنید و پیش از مراجعه، اطلاعات را تأیید کنید.</p>
        </section>

        <JourneyFlow />

        <section id="about" className="about" aria-labelledby="about-title" tabIndex={-1}>
          <h2 id="about-title">پیش از مراجعه بررسی کنید</h2>
          <p className="muted">اطلاعات ثبت‌شده، تضمین موجودی یا قیمت فعلی نیست. موجودی، قیمت و شرایط خرید باید پیش از مراجعه تأیید شوند.</p>
        </section>
      </main>
      <footer className="site-footer container">
        <p>استوراسکاوت · راهنمای انتخاب آگاهانه</p>
      </footer>
    </div>
  )
}
