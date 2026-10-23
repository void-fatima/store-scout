import type { AlternativesResponse } from '../../contracts'
import { recordedNumber, recordedTimestamp } from '../../journey/comparison/recordedValues'
import { Icon } from '../../shell/Icon'

export function SourceBadge({ response }: { response: AlternativesResponse }) {
  const dataset = response.original.context.dataset
  return <span className="source-badge"><Icon name="info" />{dataset?.source_kind === 'sample' ? 'داده‌های نمونه و ساختگی'
    : dataset?.source_kind === 'provided' ? 'داده‌های واردشده؛ هویت تأیید نشده' : 'منبع داده نامشخص'} · پوشش محدود تهران</span>
}
export function Provenance({ response }: { response: AlternativesResponse }) {
  const dataset = response.original.context.dataset
  const warnings = [...new Set([...response.warnings, ...(response.original.notices ?? []), ...(response.original.context.notices ?? [])])]
  return <details className="data-provenance"><summary><Icon name="info" />منبع، پوشش و محدودیت‌های اطلاعات<Icon name="chevron" /></summary>
    <div className="provenance-content">
      <p>این پیشنهادها فقط از آفرهای ثبت‌شده و بازیابی‌شده‌اند؛ رتبه‌بندی همهٔ بازار نیست. فروشگاه‌های صرفاً دسته‌بندی‌شده، آفر موجودی کالا محسوب نمی‌شوند.</p>
      <p>زمان تغییر قیمت، تأیید قیمت فعلی یا موجودی نیست. فاصلهٔ مستقیم، مسیر خیابانی یا زمان سفر نیست.</p>
      <p>هویت فروشگاه‌ها ساختگی یا تأییدنشده است؛ اطلاعات تماس ساختگی برای تماس مناسب نیست.</p>
      <SourceBadge response={response} />
      {dataset && <p>ورود داده: {recordedTimestamp(dataset.imported_at)}؛ این زمان، تأیید موجودی نیست.</p>}
      <ul>{response.coverage.map((coverage, index) => <li key={index}>جست‌وجوی «{coverage.query.q || response.original_constraints.query}»: {recordedNumber(coverage.retrieved_count)} آفر از {recordedNumber(coverage.catalog_total)} رکورد؛ {coverage.complete_for_query ? 'بازیابی این پرس‌وجو کامل است، پوشش بازار کامل نیست.' : 'بازیابی این پرس‌وجو محدود است.'}</li>)}</ul>
      {!!warnings.length && <ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      {dataset && <details><summary>شناسه‌های منبع</summary><dl><dt>شناسهٔ داده</dt><dd><bdi>{dataset.dataset_id}</bdi></dd><dt>اثر انگشت محتوا</dt><dd><bdi>{dataset.source_sha256}</bdi></dd></dl></details>}
    </div>
  </details>
}
