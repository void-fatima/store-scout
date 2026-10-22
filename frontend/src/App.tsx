export default function App() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">رفتن به محتوای اصلی</a>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#main-content" aria-label="استوراسکاوت، خانه">
            استوراسکاوت
          </a>
          <nav aria-label="ناوبری اصلی">
            <a href="#main-content" aria-current="page">راهنمای خرید</a>
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

        <section className="foundation-note" aria-labelledby="preparation-title">
          <h2 id="preparation-title">راهنمای خرید در حال آماده‌سازی است</h2>
          <p>در مرحلهٔ بعد، جست‌وجو و پیشنهادهای متناسب با نیاز شما به این صفحه اضافه می‌شوند.</p>
          {/* Mount the future RecommendationPanel here. Setayesh owns its feature directory. */}
          <div id="recommendation-root" />
        </section>

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
