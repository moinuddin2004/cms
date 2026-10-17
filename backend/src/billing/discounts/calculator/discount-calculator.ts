import { DiscountKind } from '../../enums/billing.enums';
import {
  Paisa,
  splitProportionally,
  sumPaisa,
  toPaisa,
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
  grossPaisa: Paisa,
  rule: DiscountRule,
): Paisa {
  let amount = DISCOUNT_STRATEGIES[rule.kind].single(grossPaisa, rule.value);
  if (rule.maxAmount != null)
    amount = Math.min(amount, toPaisa(rule.maxAmount));
  return Math.max(0, Math.min(amount, grossPaisa));
}

/**
 * One rule over several charges. PERCENTAGE: per charge, and when the sum
 * exceeds `maxAmount` the cap is re-split proportionally. FIXED: one total
 * (≤ sum of gross) split by gross. Every share is capped by its gross.
 */
export function discountsForCharges(
  grossesPaisa: readonly Paisa[],
  rule: DiscountRule,
): Paisa[] {
  let amounts = DISCOUNT_STRATEGIES[rule.kind].bulk(grossesPaisa, rule.value);
  if (rule.maxAmount != null) {
    const cap = toPaisa(rule.maxAmount);
    if (sumPaisa(amounts) > cap) amounts = splitProportionally(cap, amounts);
  }
  return amounts.map((a, i) => Math.max(0, Math.min(a, grossesPaisa[i])));
}
