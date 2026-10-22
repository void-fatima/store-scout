import hero from '../assets/search-hero.jpg'
import { Icon } from './Icon'

export function LandingHero() {
  return <section className="landing-hero" aria-labelledby="page-title">
    <div className="hero-copy">
      <h1 id="page-title"><span className="hero-opening">قبل از رفتن، </span><span className="hero-choice"><em>هوشمندانه</em> انتخاب کن</span></h1>
      <p>کالاها و فروشگاه‌های ثبت‌شده را مقایسه کن؛ با دلیل روشن برای هر انتخاب.</p>
    </div>
    <img className="hero-art" src={hero} width="887" height="290" alt="" fetchPriority="high" />
  </section>
}

export function BuyingGuide() {
  return <section id="guide" className="buying-guide" tabIndex={-1} aria-label="راهنمای خرید">
    <ol className="guide-steps">
      <li><div className="step-art step-coral"><Icon name="search" /><span>۱</span></div>
        <h2>نیازت را مشخص کن</h2><p>نام کالا، حداکثر بودجه و مختصات محل دلخواهت را وارد کن.</p></li>
      <li><div className="step-art step-lavender"><Icon name="list" /><span>۲</span></div>
        <h2>گزینه‌ها را مقایسه کن</h2><p>پیشنهادهای ثبت‌شده را با توجه به قیمت، فاصله و دلیل هر انتخاب بررسی کن.</p></li>
      <li><div className="step-art step-mint"><Icon name="map" /><span>۳</span></div>
        <h2>پیش از مراجعه بررسی کن</h2><p>موجودی، قیمت و شرایط خرید را از فروشگاه بپرس و با آگاهی بیشتر راهی شو.</p></li>
    </ol>
  </section>
}
