import { activeCurrency } from '@/lib/currency'
import { format } from 'date-fns'
import { formatYmd as formatCalendarYmd, inClinic } from '@/lib/datetime'

// Integer-only conversions between what people type and what the API
// stores (minor units). No floating point: "4500.5" is exactly 450050 minor units.

const RUPEES = /^\s*(\d{1,10})(?:\.(\d{0,2}))?\s*$/

/** "4500.5" → 450050. Null when not a non-negative amount with ≤ 2 decimals. */
export function rupeesToMinor(text: string): number | null {
  const m = RUPEES.exec(text)
  if (!m) return null
  return (
    Number(m[1]) * 100 +
    Number(((m[2] as string | undefined) ?? '').padEnd(2, '0'))
  )
}

/** 450050 → "4500.5" (for pre-filling inputs). */
export function minorToRupeesText(minor: number): string {
  const whole = Math.trunc(minor / 100)
  const frac = String(minor % 100)
    .padStart(2, '0')
    .replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : String(whole)
}

/** 450050 → "PKR 4,500.50" (the active clinic's currency by default). */
export function formatMinor(
  minor: number,
  currency = activeCurrency(),
): string {
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(minor)
  const whole = Math.trunc(abs / 100).toLocaleString('en-PK')
  const frac = String(abs % 100).padStart(2, '0')
  return `${sign}${currency} ${whole}${frac === '00' ? '' : `.${frac}`}`
}

/** "2026-10-19" → "19 Oct 2026" (calendar date, no timezone shift). */
export function formatYmd(ymd: string): string {
  return formatCalendarYmd(ymd, 'd MMM yyyy')
}

/**
 * Today as "YYYY-MM-DD" on the catalog's price calendar. Lab prices are
 * platform-level, so this is the platform zone (backend `CATALOG_TIMEZONE`),
 * NOT the clinic's — every lab's price switches over at the same midnight.
 */
export function catalogToday(): string {
  return format(new Date(), 'yyyy-MM-dd', inClinic('Asia/Karachi'))
}
