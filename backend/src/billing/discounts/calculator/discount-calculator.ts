import { DiscountKind } from '../../enums/billing.enums';
import {
  Minor,
  splitProportionally,
  sumMinor,
  toMinor,
} from '../../common/money';
import {
  DiscountStrategy,
  FixedDiscountStrategy,
  PercentageDiscountStrategy,
} from './strategies/discount-strategy';

/**
 * Discount amounts (6.3). Pure: the functional core of discounting.
 * Order: strategy amount → cap by `maxAmount` → cap by gross.
 */
export const DISCOUNT_STRATEGIES: Readonly<
  Record<DiscountKind, DiscountStrategy>
> = {
  [DiscountKind.PERCENTAGE]: new PercentageDiscountStrategy(),
  [DiscountKind.FIXED]: new FixedDiscountStrategy(),
};

export interface DiscountRule {
  kind: DiscountKind;
  value: number;
  /** Rupees; null = no cap. */
  maxAmount: number | null;
}

export function discountForCharge(
  grossMinor: Minor,
  rule: DiscountRule,
): Minor {
  let amount = DISCOUNT_STRATEGIES[rule.kind].single(grossMinor, rule.value);
  if (rule.maxAmount != null)
    amount = Math.min(amount, toMinor(rule.maxAmount));
  return Math.max(0, Math.min(amount, grossMinor));
}

/**
 * One rule over several charges. PERCENTAGE: per charge, and when the sum
 * exceeds `maxAmount` the cap is re-split proportionally. FIXED: one total
 * (≤ sum of gross) split by gross. Every share is capped by its gross.
 */
export function discountsForCharges(
  grossesMinor: readonly Minor[],
  rule: DiscountRule,
): Minor[] {
  let amounts = DISCOUNT_STRATEGIES[rule.kind].bulk(grossesMinor, rule.value);
  if (rule.maxAmount != null) {
    const cap = toMinor(rule.maxAmount);
    if (sumMinor(amounts) > cap) amounts = splitProportionally(cap, amounts);
  }
  return amounts.map((a, i) => Math.max(0, Math.min(a, grossesMinor[i])));
}
