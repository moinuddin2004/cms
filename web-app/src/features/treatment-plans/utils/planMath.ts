import type { DiscountKind } from '../types'

export interface PlanTotals {
  total: number
  discount: number
  final: number
}

const toMinor = (rupees: number) => Math.round(rupees * 100)

/**
 * Preview of the plan total — same rule as the backend: a percentage follows
 * the total, a fixed amount is capped by it. Rupees in, rupees out.
 */
export function planTotals(
  prices: ReadonlyArray<number | null | undefined>,
  kind: DiscountKind | null | undefined,
  value: number | null | undefined,
): PlanTotals {
  const gross = prices.reduce<number>((s, p) => s + toMinor(p ?? 0), 0)
  let off = 0
  if (kind && value != null && value > 0) {
    off =
      kind === 'PERCENTAGE'
        ? Math.round((gross * Math.min(value, 100)) / 100)
        : toMinor(value)
  }
  off = Math.max(0, Math.min(off, gross))
  return { total: gross / 100, discount: off / 100, final: (gross - off) / 100 }
}
