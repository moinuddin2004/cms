/**
 * Sales-tax display helpers. The backend computes every tax amount (the
 * frontend never computes money); these only format the rate.
 */

/** True when an invoice carries a tax line (rate > 0). */
export const hasTax = (rate: number | string | null | undefined): boolean =>
  Number(rate ?? 0) > 0

/** "Tax (17%)", "Tax (17.5%)". */
export const taxLabel = (rate: number | string | null | undefined): string =>
  `Tax (${Number(Number(rate ?? 0).toFixed(2))}%)`
