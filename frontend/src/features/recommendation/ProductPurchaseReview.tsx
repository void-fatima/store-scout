import type { ResponseEntry } from '../../journey/operations'
import { hasOwningPlan, useOwningVerification } from './useOwningVerification'
import { RecordedVisitConditions, VerificationQuestions } from './VerificationContent'
import { offerHash } from './presentation'

/** Embedded presentation of the controller-resolved plan, with no route focus. */
export function ProductPurchaseReview({ entry }: { entry: ResponseEntry }) {
  const plan = useOwningVerification(entry)
  if (!entry.plan) return <p role="status">برنامهٔ بررسی برای این آفر در دسترس نیست.</p>
  if (!hasOwningPlan(entry)) return <p role="alert">شناسه‌های برنامه با آفر فعلی سازگار نیست؛ برنامهٔ قبلی نمایش داده نمی‌شود.</p>
  if (!plan) return <p role="status">برنامه باید با انتخاب فعلی هماهنگ شود؛ برنامهٔ قدیمی نمایش داده نمی‌شود.</p>
  return <div className="product-purchase-review">
    <p>این برنامهٔ آفر انتخاب‌شده است؛ سؤال‌ها تا بررسی واقعی همچنان در انتظار بررسی می‌مانند.</p>
    <VerificationQuestions entry={entry} plan={plan} />
    <RecordedVisitConditions entry={entry} plan={plan} />
    <a className="outline-action" href={offerHash('checklist', entry.key)} data-offer-action={offerHash('checklist', entry.key)}>باز کردن چک‌لیست مستقل</a>
  </div>
}
