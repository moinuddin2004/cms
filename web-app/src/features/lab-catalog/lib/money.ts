// Integer-only conversions between what people type and what the API
// stores (paisa). No floating point: "4500.5" is exactly 450050 paisa.

const RUPEES = /^\s*(\d{1,10})(?:\.(\d{0,2}))?\s*$/

/** "4500.5" → 450050. Null when not a non-negative amount with ≤ 2 decimals. */
export function rupeesToPaisa(text: string): number | null {
  const m = RUPEES.exec(text)
  if (!m) return null
  return (
    Number(m[1]) * 100 +
    Number(((m[2] as string | undefined) ?? '').padEnd(2, '0'))
  )
}

/** 450050 → "4500.5" (for pre-filling inputs). */
export function paisaToRupeesText(paisa: number): string {
  const whole = Math.trunc(paisa / 100)
  const frac = String(paisa % 100)
    .padStart(2, '0')
    .replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : String(whole)
}

/** 450050 → "PKR 4,500.50". */
export function formatPaisa(paisa: number, currency = 'PKR'): string {
  const sign = paisa < 0 ? '-' : ''
  const abs = Math.abs(paisa)
  const whole = Math.trunc(abs / 100).toLocaleString('en-PK')
  const frac = String(abs % 100).padStart(2, '0')
  return `${sign}${currency} ${whole}${frac === '00' ? '' : `.${frac}`}`
}

/** "2026-10-19" → "19 Oct 2026" (calendar date, no timezone shift). */
export function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Today as "YYYY-MM-DD" in Pakistan time — the catalog's price calendar. */
export function catalogToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })
}
