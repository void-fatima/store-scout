const numbers = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 3 })
export const unknown = 'نامشخص'
export const recordedNumber = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? unknown : numbers.format(value)
export const recordedText = (value: string | null | undefined) => value?.trim() || unknown

const days = [
  ['sat', 'شنبه'], ['sun', 'یکشنبه'], ['mon', 'دوشنبه'], ['tue', 'سه‌شنبه'],
  ['wed', 'چهارشنبه'], ['thu', 'پنجشنبه'], ['fri', 'جمعه'],
] as const

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Render only the declared local-time structure used by the canonical sample.
// Other JSON values remain unknown; this does not calculate opening status.
function shifts(value: unknown): string {
  if (!record(value) || value.status !== 'declared' || !Array.isArray(value.shifts) || !value.shifts.length) return unknown
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/
  const ranges: string[] = []
  for (const shift of value.shifts) {
    if (!record(shift) || typeof shift.start_time !== 'string' || typeof shift.end_time !== 'string'
      || !time.test(shift.start_time) || !time.test(shift.end_time)) return unknown
    ranges.push(`${shift.start_time} تا ${shift.end_time}`)
  }
  return ranges.join('، ')
}

export function recordedHours(value: Record<string, unknown> | null | undefined) {
  return days.map(([key, label]) => ({ day: key, label, hours: shifts(value?.[key]) }))
}

export function recordedPayments(value: readonly unknown[] | null | undefined): string {
  if (!value?.length) return unknown
  const known = value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  if (!known.length) return unknown
  return `${known.join('، ')}${known.length !== value.length ? '؛ بخشی از شرایط نامشخص است' : ''} (ثبت‌شده و تأییدنشده)`
}

export function recordedTimestamp(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return unknown
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran',
  }).format(new Date(value))
}
