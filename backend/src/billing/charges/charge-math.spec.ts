import { Charge } from '../entities/charge.entity';
import { ChargeStatus, DiscountKind } from '../enums/billing.enums';
import { chargeBalanceMinor, clearDiscount, recalcCharge } from './charge-math';

const charge = (over: Record<string, unknown> = {}): Charge =>
  ({
    quantity: 3,
    unitPrice: 33.33,
    discountAmount: 0,
    discountKind: null,
    discountValue: null,
    netAmount: 0,
    taxAmount: 0,
    allocatedAmount: 0,
    status: ChargeStatus.ACTIVE,
    ...over,
  }) as unknown as Charge;

describe('recalcCharge', () => {
  it('gross = qty × price, with no float drift', () => {
    const c = charge();
    recalcCharge(c);
    expect(c.grossAmount).toBe(99.99);
    expect(c.netAmount).toBe(99.99);
  });

  it('a percentage discount follows the new gross', () => {
    const c = charge({
      quantity: 2,
      unitPrice: 100,
      discountKind: DiscountKind.PERCENTAGE,
      discountValue: 10,
    });
    recalcCharge(c);
    expect(c.discountAmount).toBe(20);
    expect(c.netAmount).toBe(180);
    c.quantity = 4;
    recalcCharge(c);
    expect(c.discountAmount).toBe(40);
    expect(c.netAmount).toBe(360);
  });

  it('a fixed discount is capped by gross and never negative', () => {
    const c = charge({ quantity: 1, unitPrice: 50, discountAmount: 80 });
    recalcCharge(c);
    expect(c.discountAmount).toBe(50);
    expect(c.netAmount).toBe(0);
    const n = charge({ quantity: 1, unitPrice: 50, discountAmount: -5 });
    recalcCharge(n);
    expect(n.discountAmount).toBe(0);
    expect(n.netAmount).toBe(50);
  });
});

describe('clearDiscount', () => {
  it('removes the discount and restores net to gross', () => {
    const c = charge({
      quantity: 1,
      unitPrice: 200,
      discountKind: DiscountKind.PERCENTAGE,
      discountValue: 25,
      discountAmount: 50,
    });
    clearDiscount(c);
    expect(c.discountKind).toBeNull();
    expect(c.discountAmount).toBe(0);
    expect(c.netAmount).toBe(200);
  });
});

describe('chargeBalanceMinor', () => {
  it('= net + tax − allocated, in minor units', () => {
    expect(
      chargeBalanceMinor({
        status: ChargeStatus.ACTIVE,
        netAmount: 100,
        taxAmount: 17,
        allocatedAmount: 50.5,
      }),
    ).toBe(6650);
  });

  it('is 0 for void charges regardless of allocations', () => {
    expect(
      chargeBalanceMinor({
        status: ChargeStatus.VOID,
        netAmount: 100,
        taxAmount: 0,
        allocatedAmount: 30,
      }),
    ).toBe(0);
  });
});
