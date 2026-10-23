import { ServiceKind } from '../enums/billing.enums';
import {
  bpsToPercent,
  commissionTarget,
  CommissionTargetInput,
  divRoundHalfUp,
  percentToBps,
  resolveCommissionRate,
  rupeesToPaisa,
} from './commission-math';
import { CommissionBasis, CompensationPlanType } from './commission.enums';

/** Entries the cumulative approach writes for successive allocation totals. */
function entriesFor(
  base: Omit<CommissionTargetInput, 'allocatedPaisa'>,
  allocatedSteps: number[],
): number[] {
  let already = 0;
  const out: number[] = [];
  for (const allocated of allocatedSteps) {
    const { targetPaisa } = commissionTarget({
      ...base,
      allocatedPaisa: allocated,
    });
    if (targetPaisa !== already) out.push(targetPaisa - already);
    already = targetPaisa;
  }
  return out;
}

const net = (netPaisa: number, rateBps: number) => ({
  netPaisa,
  grossPaisa: netPaisa,
  basis: CommissionBasis.NET,
  rateBps,
  fixedPaisa: null,
});

describe('commissionTarget', () => {
  describe('with sales tax on the charge', () => {
    // Rs 1,000 net + 17% tax = Rs 1,170 payable; tax is not doctor revenue.
    const taxed = { ...net(100_000, 4000), taxPaisa: 17_000 };

    it('earns on the pre-tax amount only when fully paid', () => {
      const t = commissionTarget({ ...taxed, allocatedPaisa: 117_000 });
      expect(t.collectedPaisa).toBe(100_000);
      expect(t.targetPaisa).toBe(40_000);
    });

    it('splits a part payment pro rata between net and tax', () => {
      // Rs 585 paid = half of 1,170 → Rs 500 pre-tax → Rs 200 at 40%.
      const t = commissionTarget({ ...taxed, allocatedPaisa: 58_500 });
      expect(t.collectedPaisa).toBe(50_000);
      expect(t.targetPaisa).toBe(20_000);
    });

    it('installments still sum exactly to the full commission', () => {
      const entries = entriesFor(taxed, [39_000, 78_000, 117_000]);
      expect(entries.reduce((a, b) => a + b, 0)).toBe(40_000);
    });

    it('a fixed amount is reached only when net + tax is collected', () => {
      const fixed = { ...taxed, rateBps: null, fixedPaisa: 30_000 };
      expect(
        commissionTarget({ ...fixed, allocatedPaisa: 100_000 }).targetPaisa,
      ).toBeLessThan(30_000);
      expect(
        commissionTarget({ ...fixed, allocatedPaisa: 117_000 }).targetPaisa,
      ).toBe(30_000);
    });

    it('tax 0 / omitted behaves exactly as before', () => {
      expect(
        commissionTarget({ ...net(100_000, 4000), allocatedPaisa: 50_000 }),
      ).toEqual(
        commissionTarget({
          ...net(100_000, 4000),
          taxPaisa: 0,
          allocatedPaisa: 50_000,
        }),
      );
    });
  });

  it('40% NET on a Rs 1,000 charge paid in 3 installments sums exactly to Rs 400', () => {
    const entries = entriesFor(net(100_000, 4000), [33_333, 66_666, 100_000]);
    expect(entries).toEqual([13_333, 13_333, 13_334]);
    expect(entries.reduce((a, b) => a + b, 0)).toBe(40_000);
  });

  it('GROSS basis: the clinic absorbs the discount', () => {
    const base = {
      netPaisa: 80_000,
      grossPaisa: 100_000,
      basis: CommissionBasis.GROSS,
      rateBps: 4000,
      fixedPaisa: null,
    };
    expect(
      commissionTarget({ ...base, allocatedPaisa: 80_000 }).targetPaisa,
    ).toBe(40_000);
    expect(
      commissionTarget({ ...base, allocatedPaisa: 40_000 }).targetPaisa,
    ).toBe(20_000);
    // Same charge on NET basis: the doctor shares the discount.
    expect(
      commissionTarget({
        ...base,
        basis: CommissionBasis.NET,
        allocatedPaisa: 80_000,
      }).targetPaisa,
    ).toBe(32_000);
  });

  it('fixed amount rule with partial payment is proportional to what was collected', () => {
    const base = {
      netPaisa: 80_000,
      grossPaisa: 80_000,
      basis: CommissionBasis.NET,
      rateBps: null,
      fixedPaisa: 50_000,
    };
    expect(
      commissionTarget({ ...base, allocatedPaisa: 30_000 }).targetPaisa,
    ).toBe(18_750);
    expect(entriesFor(base, [30_000, 80_000])).toEqual([18_750, 31_250]);
  });

  it('rounds odd paisa half up', () => {
    expect(
      commissionTarget({ ...net(12_345, 1000), allocatedPaisa: 12_345 })
        .targetPaisa,
    ).toBe(1_235); // 1234.5
    expect(
      commissionTarget({ ...net(5, 1000), allocatedPaisa: 5 }).targetPaisa,
    ).toBe(1); // 0.5
    expect(
      commissionTarget({ ...net(3, 5000), allocatedPaisa: 3 }).targetPaisa,
    ).toBe(2); // 1.5
    expect(
      commissionTarget({ ...net(7, 3333), allocatedPaisa: 7 }).targetPaisa,
    ).toBe(2); // 2.3331
  });

  it('net = 0 earns nothing, whatever was allocated', () => {
    expect(
      commissionTarget({ ...net(0, 4000), allocatedPaisa: 5_000 }),
    ).toEqual({
      collectedPaisa: 0,
      targetPaisa: 0,
    });
  });

  it('caps collected at net and reverses on unapply', () => {
    expect(
      commissionTarget({ ...net(10_000, 4000), allocatedPaisa: 15_000 }),
    ).toEqual({
      collectedPaisa: 10_000,
      targetPaisa: 4_000,
    });
    expect(entriesFor(net(10_000, 4000), [10_000, 0])).toEqual([4_000, -4_000]);
  });

  it('a discount after payment produces an adjustment', () => {
    // Paid 10,000 in full; discount lowers net to 8,000 and 2,000 goes to advance.
    const before = commissionTarget({
      ...net(10_000, 4000),
      allocatedPaisa: 10_000,
    });
    const after = commissionTarget({
      ...net(8_000, 4000),
      allocatedPaisa: 8_000,
    });
    expect(after.targetPaisa - before.targetPaisa).toBe(-800);
  });

  it('lab case: the rate applies to the price minus the lab cost (lab ERD §15 worked example)', () => {
    // Two crowns: patient 28,000 after discount, lab 10,000 → 40% of 18,000.
    const lab = { ...net(2_800_000, 4000), labCostPaisa: 1_000_000 };
    expect(
      commissionTarget({ ...lab, allocatedPaisa: 2_800_000 }).targetPaisa,
    ).toBe(720_000);
    // Advance of 10,000 first: pro rata to what was collected, drift-free.
    const entries = entriesFor(lab, [1_000_000, 2_800_000]);
    expect(entries.reduce((a, b) => a + b, 0)).toBe(720_000);
    expect(entries[0]).toBe(257_143);
  });

  it('lab cost at or above the price earns nothing; fixed amounts are not reduced', () => {
    expect(
      commissionTarget({
        ...net(500_000, 4000),
        labCostPaisa: 600_000,
        allocatedPaisa: 500_000,
      }).targetPaisa,
    ).toBe(0);
    expect(
      commissionTarget({
        netPaisa: 500_000,
        grossPaisa: 500_000,
        basis: CommissionBasis.NET,
        rateBps: null,
        fixedPaisa: 50_000,
        labCostPaisa: 200_000,
        allocatedPaisa: 500_000,
      }).targetPaisa,
    ).toBe(50_000);
  });
});

describe('divRoundHalfUp', () => {
  it('rounds halves away from zero', () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divRoundHalfUp(4n, 3n)).toBe(1n);
    expect(divRoundHalfUp(-5n, 2n)).toBe(-3n);
    expect(() => divRoundHalfUp(1n, 0n)).toThrow();
  });
});

describe('resolveCommissionRate', () => {
  const plan = {
    type: CompensationPlanType.COMMISSION,
    defaultRateBps: 3000,
    rules: [
      {
        serviceId: 'svc-rct',
        serviceCategory: null,
        rateBps: 5000,
        fixedAmountPaisa: null,
      },
      {
        serviceId: 'svc-xray',
        serviceCategory: null,
        rateBps: null,
        fixedAmountPaisa: 20_000,
      },
      {
        serviceId: null,
        serviceCategory: ServiceKind.CONSULTATION,
        rateBps: 6000,
        fixedAmountPaisa: null,
      },
    ],
  };

  it('service rule → category rule → plan default', () => {
    expect(
      resolveCommissionRate(plan, {
        serviceId: 'svc-rct',
        serviceKind: ServiceKind.PROCEDURE,
      }),
    ).toEqual({
      rateBps: 5000,
      fixedPaisa: null,
      source: 'SERVICE',
    });
    expect(
      resolveCommissionRate(plan, {
        serviceId: 'svc-other',
        serviceKind: ServiceKind.CONSULTATION,
      }),
    ).toEqual({
      rateBps: 6000,
      fixedPaisa: null,
      source: 'CATEGORY',
    });
    expect(
      resolveCommissionRate(plan, {
        serviceId: null,
        serviceKind: ServiceKind.OTHER,
      }),
    ).toEqual({
      rateBps: 3000,
      fixedPaisa: null,
      source: 'DEFAULT',
    });
  });

  it('a rule may carry a fixed amount instead of a rate', () => {
    expect(
      resolveCommissionRate(plan, {
        serviceId: 'svc-xray',
        serviceKind: ServiceKind.PROCEDURE,
      }),
    ).toEqual({
      rateBps: null,
      fixedPaisa: 20_000,
      source: 'SERVICE',
    });
  });

  it('a service rule beats a category rule for the same kind', () => {
    expect(
      resolveCommissionRate(
        {
          ...plan,
          rules: [
            ...plan.rules,
            {
              serviceId: 'svc-consult',
              serviceCategory: null,
              rateBps: 100,
              fixedAmountPaisa: null,
            },
          ],
        },
        { serviceId: 'svc-consult', serviceKind: ServiceKind.CONSULTATION },
      )?.rateBps,
    ).toBe(100);
  });

  it('salary-only plans earn nothing', () => {
    expect(
      resolveCommissionRate(
        { type: CompensationPlanType.SALARY, defaultRateBps: null, rules: [] },
        { serviceId: null, serviceKind: ServiceKind.OTHER },
      ),
    ).toBeNull();
  });
});

describe('text conversions', () => {
  it('percent ↔ basis points', () => {
    expect(percentToBps('40')).toBe(4000);
    expect(percentToBps('12.5')).toBe(1250);
    expect(percentToBps('0.05')).toBe(5);
    expect(percentToBps('100')).toBe(10_000);
    expect(percentToBps('100.01')).toBeNull();
    expect(percentToBps('1.234')).toBeNull();
    expect(percentToBps('-1')).toBeNull();
    expect(percentToBps('abc')).toBeNull();
    expect(bpsToPercent(4000)).toBe('40');
    expect(bpsToPercent(1250)).toBe('12.5');
    expect(bpsToPercent(5)).toBe('0.05');
  });

  it('rupees → paisa', () => {
    expect(rupeesToPaisa('50000.5')).toBe(5_000_050);
    expect(rupeesToPaisa(1200)).toBe(120_000);
    expect(rupeesToPaisa(0.1)).toBe(10);
    expect(rupeesToPaisa('0.07')).toBe(7);
    expect(rupeesToPaisa('1.005')).toBeNull();
  });
});
