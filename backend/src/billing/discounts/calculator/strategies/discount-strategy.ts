import { DiscountKind } from '../../../enums/billing.enums';
import {
  Minor,
  percentOf,
  splitProportionally,
  sumMinor,
  toMinor,
} from '../../../common/money';

/** How one discount kind turns a value into amounts (Strategy, 13.5). Pure. */
export interface DiscountStrategy {
  readonly kind: DiscountKind;
  /** Uncapped amount for a single charge. */
  single(grossMinor: Minor, value: number): Minor;
  /** Uncapped amounts for several charges given one value ("apply to all"). */
  bulk(grossesMinor: readonly Minor[], value: number): Minor[];
}

export class PercentageDiscountStrategy implements DiscountStrategy {
  readonly kind = DiscountKind.PERCENTAGE;

  single(grossMinor: Minor, value: number): Minor {
    return percentOf(grossMinor, value);
  }

  bulk(grossesMinor: readonly Minor[], value: number): Minor[] {
    return grossesMinor.map((g) => percentOf(g, value));
  }
}

export class FixedDiscountStrategy implements DiscountStrategy {
  readonly kind = DiscountKind.FIXED;

  single(_grossMinor: Minor, value: number): Minor {
    return toMinor(value);
  }

  /** One fixed amount for the whole selection, split by gross (6.3). */
  bulk(grossesMinor: readonly Minor[], value: number): Minor[] {
    const total = Math.min(toMinor(value), sumMinor(grossesMinor));
    return splitProportionally(total, grossesMinor);
  }
}
