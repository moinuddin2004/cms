import { activeCurrency } from '@/lib/currency'

// Integer-only conversions between what people type and what the API
// stores (paisa, basis points). Mirrors backend `commission-math.ts`; no
// floating point anywhere so 12.5% is exactly 1250 bps.

const DECIMAL = /^\s*(\d+)(?:\.(\d{0,2}))?\s*$/

/** "40" → 4000, "12.5" → 1250. Null when not a 0–100 % value with ≤ 2 decimals. */
export function percentToBps(text: string): number | null {
  const m = DECIMAL.exec(text)
  if (!m) return null
  const bps =
    Number(m[1]) * 100 +
    Number(((m[2] as string | undefined) ?? '').padEnd(2, '0'))
  return bps <= 10_000 ? bps : null
}

/** 4000 → "40", 1250 → "12.5", 5 → "0.05". */
export function bpsToPercent(bps: number): string {
  const whole = Math.trunc(bps / 100)
  const frac = String(bps % 100)
    .padStart(2, '0')
    .replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : String(whole)
}

/** "50000.5" → 5000050. Null when not a non-negative amount with ≤ 2 decimals. */
export function rupeesToPaisa(text: string): number | null {
  const m = DECIMAL.exec(text)
  if (!m) return null
  return (
    Number(m[1]) * 100 +
    Number(((m[2] as string | undefined) ?? '').padEnd(2, '0'))
  )
}

/** 5000050 → "50000.5" (for pre-filling inputs). */
export function paisaToRupeesText(paisa: number): string {
  return bpsToPercent(paisa)
}

/** 5000050 → "PKR 50,000.50" (active clinic currency); negatives keep their sign. */
export function formatPaisa(paisa: number): string {
  const sign = paisa < 0 ? '-' : ''
  const abs = Math.abs(paisa)
  const whole = Math.trunc(abs / 100).toLocaleString('en-PK')
  const frac = String(abs % 100).padStart(2, '0')
  return `${sign}${activeCurrency()} ${whole}${frac === '00' ? '' : `.${frac}`}`
}
