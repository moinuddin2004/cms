import { DiscountKind } from '../../../enums/billing.enums';
import {
  Paisa,
  percentOf,
  splitProportionally,
  sumPaisa,
  toPaisa,
} from '../../../common/money';

/** How one discount kind turns a value into amounts (Strategy, 13.5). Pure. */
export interface DiscountStrategy {
  readonly kind: DiscountKind;
  /** Uncapped amount for a single charge. */
  single(grossPaisa: Paisa, value: number): Paisa;
  /** Uncapped amounts for several charges given one value ("apply to all"). */
  bulk(grossesPaisa: readonly Paisa[], value: number): Paisa[];
}

export class PercentageDiscountStrategy implements DiscountStrategy {
  readonly kind = DiscountKind.PERCENTAGE;

  single(grossPaisa: Paisa, value: number): Paisa {
    return percentOf(grossPaisa, value);
  }

  bulk(grossesPaisa: readonly Paisa[], value: number): Paisa[] {
    return grossesPaisa.map((g) => percentOf(g, value));
  }
}

export class FixedDiscountStrategy implements DiscountStrategy {
  readonly kind = DiscountKind.FIXED;

  single(_grossPaisa: Paisa, value: number): Paisa {
    return toPaisa(value);
  }

  /** One fixed amount for the whole selection, split by gross (6.3). */
  bulk(grossesPaisa: readonly Paisa[], value: number): Paisa[] {
    const total = Math.min(toPaisa(value), sumPaisa(grossesPaisa));
    return splitProportionally(total, grossesPaisa);
  }
}
