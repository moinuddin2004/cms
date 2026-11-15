/**
 * Money formatting. Pure — the currency code and locale are parameters, so
 * this module imports neither space.
 */

/**
 * "PKR 12,500" / "PKR 84,000.50" — `currency` is an ISO 4217 code. Whole amounts show no
 * decimals; fractional amounts always show exactly two (and never float noise like .5000001).
 */
export function formatMoney(amount: number, currency: string, locale = 'en-PK'): string {
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  const digits = whole ? 0 : 2;
  return `${currency} ${amount.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}
