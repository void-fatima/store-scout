import type { RecommendationResult } from '../../contracts'
import { Icon } from '../../shell/Icon'

/** Presentation of owning backend messages only; never recomputes a ranking. */
export function ExplanationReasons({ result }: { result: RecommendationResult }) {
  return result.explanation_reasons.length ? <ol className="explanation-list">{result.explanation_reasons.map((reason, index) => <li key={`${reason.code}-${index}`}>
    <Icon name="bulb" /><p>{reason.message}</p>
  </li>)}</ol> : <p>دلیلی برای این آفر در پاسخ سرویس ثبت نشده است.</p>
}

export function ExplanationLimitations({ result }: { result: RecommendationResult }) {
  return <><h3>چه چیزهایی هنوز مشخص نیست؟</h3>
    {result.data_limitations.length ? <ul className="limitations-list">{result.data_limitations.map((limitation, index) => <li key={`${limitation.code}-${index}`}>{limitation.message}</li>)}</ul>
      : <p>محدودیتی در پاسخ ثبت نشده است؛ این به معنی کامل بودن اطلاعات نیست.</p>}
    <p className="uncertainty-note">موجودی و قیمت فعلی تأیید نشده‌اند. زمان تغییر قیمت، زمان تأیید نیست. پیش از مراجعه، شرایط خرید را بررسی کن.</p>
  </>
}
