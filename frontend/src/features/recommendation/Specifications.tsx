import type { Product } from '../../contracts'
import { recordedNumber } from '../../journey/comparison/recordedValues'

const labels: Record<string, string> = { section: 'بخش', key: 'ویژگی', value: 'مقدار', unit: 'واحد' }

/** Preserve arbitrary recorded JSON as text, including nested arrays and repeats. */
function JsonRecord({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null) return <span className="muted">مقدار تهی (null)</span>
  if (value === undefined) return <span className="muted">ثبت نشده</span>
  if (typeof value === 'string') return <bdi className="spec-text">{value === '' ? 'رشتهٔ خالی ("")' : value}</bdi>
  if (typeof value === 'boolean' || typeof value === 'number') return <bdi>{String(value)}</bdi>
  if (typeof value !== 'object') return <span>ساختار پشتیبانی‌نشده</span>
  // Deep records remain complete and escaped without unbounded visual indentation.
  if (depth >= 6) return <pre className="spec-json">{JSON.stringify(value, null, 2)}</pre>
  if (Array.isArray(value)) return value.length
    ? <ol className="spec-array">{value.map((item, index) => <li key={index}><JsonRecord value={item} depth={depth + 1} /></li>)}</ol>
    : <span className="muted">فهرست خالی ([])</span>
  const entries = Object.entries(value)
  return entries.length ? <dl className="spec-values">{entries.map(([key, item]) => <div key={key}>
    <dt><bdi>{Object.hasOwn(labels, key) ? labels[key] : key || 'کلید خالی'}</bdi></dt>
    <dd><JsonRecord value={item} depth={depth + 1} /></dd>
  </div>)}</dl> : <span className="muted">رکورد خالی (&#123;&#125;)</span>
}

export function Specifications({ specs }: { specs: Product['specs'] }) {
  return !specs?.length ? <p>مشخصاتی در این رکورد ثبت نشده است.</p>
    : <ol className="spec-records">{specs.map((record, index) => <li key={index}>
      <h4>رکورد {recordedNumber(index + 1)}</h4><JsonRecord value={record} />
    </li>)}</ol>
}
