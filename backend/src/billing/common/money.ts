/**
 * Money math (6.1). Rupees cross every boundary (API, DB) with at most two
 * decimals; inside calculations everything is integer minor units so no float
 * error can creep in. Pure: no NestJS / TypeORM imports.
 */

export type Minor = number;

export const toMinor = (rupees: number | string | null | undefined): Minor =>
  Math.round(Number(rupees ?? 0) * 100);

export const fromMinor = (minor: Minor): number => minor / 100;

export const sumMinor = (xs: readonly Minor[]): Minor =>
  xs.reduce((a, b) => a + b, 0);

/** Half-up percentage of an amount in minor units. */
export const percentOf = (minor: Minor, percent: number): Minor =>
  Math.round((minor * percent) / 100);

/**
 * A percentage (≤ 2 decimals, e.g. 17.5) as integer basis points (1750).
 * Null / NaN / negative → 0; capped at 100 %.
 */
export const percentToBasisPoints = (
  percent: number | string | null | undefined,
): number => {
  const bp = Math.round(Number(percent ?? 0) * 100);
  return Number.isFinite(bp) ? Math.min(Math.max(bp, 0), 10_000) : 0;
};

/**
 * round_half_up(minor units × bp / 10 000), exact (BigInt) — the same rounding as
 * lab billing's tax (`bpOf`). For minor units ≥ 0.
 */
export const basisPointsOf = (minor: Minor, bp: number): Minor => {
  if (minor <= 0 || bp <= 0) return 0;
  return Number((BigInt(minor) * BigInt(bp) + 5000n) / 10000n);
};

export const minMinor = (...xs: Minor[]): Minor => Math.min(...xs);
export const maxMinor = (...xs: Minor[]): Minor => Math.max(...xs);

/** quantity × unit price, in minor units. */
export const lineGross = (quantity: number, unitPriceRupees: number): Minor =>
  quantity * toMinor(unitPriceRupees);

/** Rounds a rupee value to 2 decimals (for values coming out of SQL). */
export const roundRupees = (
  rupees: number | string | null | undefined,
): number => fromMinor(toMinor(rupees));

/** Adds rupee amounts through minor units. */
export const addRupees = (...xs: Array<number | string>): number =>
  fromMinor(sumMinor(xs.map(toMinor)));

/**
 * Splits `totalMinor` across `weightsMinor` proportionally. Each share is
 * floored; the leftover minor units go to the largest weight so the shares always
 * sum exactly to the total. All-zero weights → everything to the first.
 */
export function splitProportionally(
  totalMinor: Minor,
  weightsMinor: readonly Minor[],
): Minor[] {
  if (weightsMinor.length === 0) return [];
  const weightSum = sumMinor(weightsMinor);
  if (weightSum <= 0) {
    return weightsMinor.map((_, i) => (i === 0 ? totalMinor : 0));
  }
  const shares = weightsMinor.map((w) =>
    Math.floor((totalMinor * w) / weightSum),
  );
  const remainder = totalMinor - sumMinor(shares);
  let largest = 0;
  weightsMinor.forEach((w, i) => {
    if (w > weightsMinor[largest]) largest = i;
  });
  shares[largest] += remainder;
  return shares;
}
