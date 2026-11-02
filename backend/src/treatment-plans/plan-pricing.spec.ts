import { DiscountKind } from 'src/billing/enums/billing.enums';
import { normalizeDiscount, planTotals } from './plan-pricing';

describe('planTotals', () => {
  it('sums the line prices with no discount', () => {
    expect(planTotals([9000, 33000], { kind: null, value: null })).toEqual({
      estimatedCost: 42000,
      discountAmount: 0,
      finalEstimatedCost: 42000,
    });
  });

  it('takes a fixed discount off the total', () => {
    expect(
      planTotals([9000, 33000], { kind: DiscountKind.FIXED, value: 7000 }),
    ).toEqual({
      estimatedCost: 42000,
      discountAmount: 7000,
      finalEstimatedCost: 35000,
    });
  });

  it('caps a fixed discount at the total', () => {
    expect(
      planTotals([500], { kind: DiscountKind.FIXED, value: 900 })
        .finalEstimatedCost,
    ).toBe(0);
  });

  it('applies a percentage to the total, rounded to the paisa', () => {
    expect(
      planTotals([333.33, 0.01], { kind: DiscountKind.PERCENTAGE, value: 10 }),
    ).toEqual({
      estimatedCost: 333.34,
      discountAmount: 33.33,
      finalEstimatedCost: 300.01,
    });
  });

  it('treats a missing price as zero', () => {
    expect(
      planTotals([null, 100], { kind: null, value: null }).estimatedCost,
    ).toBe(100);
  });
});

describe('normalizeDiscount', () => {
  it('drops a zero or missing value', () => {
    expect(normalizeDiscount(DiscountKind.FIXED, 0)).toEqual({
      kind: null,
      value: null,
    });
    expect(normalizeDiscount(null, 50)).toEqual({ kind: null, value: null });
  });

  it('caps a percentage at 100', () => {
    expect(normalizeDiscount(DiscountKind.PERCENTAGE, 150)).toEqual({
      kind: DiscountKind.PERCENTAGE,
      value: 100,
    });
  });
});
