/**
 * Money formatting. Pure — the currency code and locale are parameters, so
 * this module imports neither space.
 */

/** "PKR 12,500" — `currency` is an ISO 4217 code. */
export function formatMoney(amount: number, currency: string, locale = 'en-PK'): string {
  return `${currency} ${amount.toLocaleString(locale)}`;
}
