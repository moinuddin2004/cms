/**
 * Money math (6.1). Rupees cross every boundary (API, DB) with at most two
 * decimals; inside calculations everything is integer paisa so no float
 * error can creep in. Pure: no NestJS / TypeORM imports.
 */

export type Paisa = number;

export const toPaisa = (rupees: number | string | null | undefined): Paisa =>
  Math.round(Number(rupees ?? 0) * 100);

export const fromPaisa = (paisa: Paisa): number => paisa / 100;

export const sumPaisa = (xs: readonly Paisa[]): Paisa =>
  xs.reduce((a, b) => a + b, 0);

/** Half-up percentage of an amount in paisa. */
export const percentOf = (paisa: Paisa, percent: number): Paisa =>
  Math.round((paisa * percent) / 100);

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
 * round_half_up(paisa × bp / 10 000), exact (BigInt) — the same rounding as
 * lab billing's tax (`bpOf`). For paisa ≥ 0.
 */
export const basisPointsOf = (paisa: Paisa, bp: number): Paisa => {
  if (paisa <= 0 || bp <= 0) return 0;
  return Number((BigInt(paisa) * BigInt(bp) + 5000n) / 10000n);
};

export const minPaisa = (...xs: Paisa[]): Paisa => Math.min(...xs);
export const maxPaisa = (...xs: Paisa[]): Paisa => Math.max(...xs);

/** quantity × unit price, in paisa. */
export const lineGross = (quantity: number, unitPriceRupees: number): Paisa =>
  quantity * toPaisa(unitPriceRupees);

/** Rounds a rupee value to 2 decimals (for values coming out of SQL). */
export const roundRupees = (
  rupees: number | string | null | undefined,
): number => fromPaisa(toPaisa(rupees));

/** Adds rupee amounts through paisa. */
export const addRupees = (...xs: Array<number | string>): number =>
  fromPaisa(sumPaisa(xs.map(toPaisa)));

/**
 * Splits `totalPaisa` across `weightsPaisa` proportionally. Each share is
 * floored; the leftover paisa go to the largest weight so the shares always
 * sum exactly to the total. All-zero weights → everything to the first.
 */
export function splitProportionally(
  totalPaisa: Paisa,
  weightsPaisa: readonly Paisa[],
): Paisa[] {
  if (weightsPaisa.length === 0) return [];
  const weightSum = sumPaisa(weightsPaisa);
  if (weightSum <= 0) {
    return weightsPaisa.map((_, i) => (i === 0 ? totalPaisa : 0));
  }
  const shares = weightsPaisa.map((w) =>
    Math.floor((totalPaisa * w) / weightSum),
  );
  const remainder = totalPaisa - sumPaisa(shares);
  let largest = 0;
  weightsPaisa.forEach((w, i) => {
    if (w > weightsPaisa[largest]) largest = i;
  });
  shares[largest] += remainder;
  return shares;
}
