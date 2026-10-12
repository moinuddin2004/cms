/**
 * Value for an `<input type="datetime-local">`: the date's LOCAL wall time as
 * "YYYY-MM-DDTHH:mm". The browser parses that value as local time, so it must
 * not come from `toISOString()` (which is UTC and shifts the time by the
 * offset — 5 hours in Pakistan — on every round trip).
 */
export function toDateTimeLocalValue(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
