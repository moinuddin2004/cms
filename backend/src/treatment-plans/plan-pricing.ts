import { fromMinor, percentOf, toMinor } from 'src/billing/common/money';
import { DiscountKind } from 'src/billing/enums/billing.enums';

export interface PlanDiscount {
  kind: DiscountKind | null;
  value: number | null;
}

export interface PlanTotals {
  /** Sum of the locked line prices (rupees). */
  estimatedCost: number;
  discountAmount: number;
  finalEstimatedCost: number;
}

/**
 * Plan total from its line prices and one plan-level discount. A percentage
 * follows the total; a fixed amount is capped by it. Rupees in, rupees out.
 */
export function planTotals(
  prices: ReadonlyArray<number | null>,
  discount: PlanDiscount,
): PlanTotals {
  const gross = prices.reduce<number>((sum, p) => sum + toMinor(p ?? 0), 0);
  let off = 0;
  if (discount.kind && discount.value != null && discount.value > 0) {
    off =
      discount.kind === DiscountKind.PERCENTAGE
        ? percentOf(gross, Math.min(discount.value, 100))
        : toMinor(discount.value);
  }
  off = Math.max(0, Math.min(off, gross));
  return {
    estimatedCost: fromMinor(gross),
    discountAmount: fromMinor(off),
    finalEstimatedCost: fromMinor(gross - off),
  };
}

/** No kind or a zero value = no discount (stored as nulls). */
export function normalizeDiscount(
  kind: DiscountKind | null | undefined,
  value: number | null | undefined,
): PlanDiscount {
  if (!kind || value == null || value <= 0) return { kind: null, value: null };
  return {
    kind,
    value: kind === DiscountKind.PERCENTAGE ? Math.min(value, 100) : value,
  };
}
