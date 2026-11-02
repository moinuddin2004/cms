import { ServiceKind } from '../enums/billing.enums';
import {
  bpsToPercent,
  commissionTarget,
  CommissionTargetInput,
  divRoundHalfUp,
  percentToBps,
  resolveCommissionRate,
  rupeesToMinor,
} from './commission-math';
import { CommissionBasis, CompensationPlanType } from './commission.enums';

/** Entries the cumulative approach writes for successive allocation totals. */
function entriesFor(
  base: Omit<CommissionTargetInput, 'allocatedMinor'>,
  allocatedSteps: number[],
): number[] {
  let already = 0;
  const out: number[] = [];
  for (const allocated of allocatedSteps) {
    const { targetMinor } = commissionTarget({
      ...base,
      allocatedMinor: allocated,
    });
    if (targetMinor !== already) out.push(targetMinor - already);
    already = targetMinor;
  }
  return out;
}

const net = (netMinor: number, rateBps: number) => ({
  netMinor,
  grossMinor: netMinor,
  basis: CommissionBasis.NET,
  rateBps,
  fixedMinor: null,
});

describe('commissionTarget', () => {
  describe('with sales tax on the charge', () => {
    // Rs 1,000 net + 17% tax = Rs 1,170 payable; tax is not doctor revenue.
    const taxed = { ...net(100_000, 4000), taxMinor: 17_000 };

    it('earns on the pre-tax amount only when fully paid', () => {
      const t = commissionTarget({ ...taxed, allocatedMinor: 117_000 });
      expect(t.collectedMinor).toBe(100_000);
      expect(t.targetMinor).toBe(40_000);
    });

    it('splits a part payment pro rata between net and tax', () => {
      // Rs 585 paid = half of 1,170 → Rs 500 pre-tax → Rs 200 at 40%.
      const t = commissionTarget({ ...taxed, allocatedMinor: 58_500 });
      expect(t.collectedMinor).toBe(50_000);
      expect(t.targetMinor).toBe(20_000);
    });

    it('installments still sum exactly to the full commission', () => {
      const entries = entriesFor(taxed, [39_000, 78_000, 117_000]);
      expect(entries.reduce((a, b) => a + b, 0)).toBe(40_000);
    });

    it('a fixed amount is reached only when net + tax is collected', () => {
      const fixed = { ...taxed, rateBps: null, fixedMinor: 30_000 };
      expect(
        commissionTarget({ ...fixed, allocatedMinor: 100_000 }).targetMinor,
      ).toBeLessThan(30_000);
      expect(
        commissionTarget({ ...fixed, allocatedMinor: 117_000 }).targetMinor,
      ).toBe(30_000);
    });

    it('tax 0 / omitted behaves exactly as before', () => {
      expect(
        commissionTarget({ ...net(100_000, 4000), allocatedMinor: 50_000 }),
      ).toEqual(
        commissionTarget({
          ...net(100_000, 4000),
          taxMinor: 0,
          allocatedMinor: 50_000,
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
      netMinor: 80_000,
      grossMinor: 100_000,
      basis: CommissionBasis.GROSS,
      rateBps: 4000,
      fixedMinor: null,
    };
    expect(
      commissionTarget({ ...base, allocatedMinor: 80_000 }).targetMinor,
    ).toBe(40_000);
    expect(
      commissionTarget({ ...base, allocatedMinor: 40_000 }).targetMinor,
    ).toBe(20_000);
    // Same charge on NET basis: the doctor shares the discount.
    expect(
      commissionTarget({
        ...base,
        basis: CommissionBasis.NET,
        allocatedMinor: 80_000,
      }).targetMinor,
    ).toBe(32_000);
  });

  it('fixed amount rule with partial payment is proportional to what was collected', () => {
    const base = {
      netMinor: 80_000,
      grossMinor: 80_000,
      basis: CommissionBasis.NET,
      rateBps: null,
      fixedMinor: 50_000,
    };
    expect(
      commissionTarget({ ...base, allocatedMinor: 30_000 }).targetMinor,
    ).toBe(18_750);
    expect(entriesFor(base, [30_000, 80_000])).toEqual([18_750, 31_250]);
  });

  it('rounds odd minor half up', () => {
    expect(
      commissionTarget({ ...net(12_345, 1000), allocatedMinor: 12_345 })
        .targetMinor,
    ).toBe(1_235); // 1234.5
    expect(
      commissionTarget({ ...net(5, 1000), allocatedMinor: 5 }).targetMinor,
    ).toBe(1); // 0.5
    expect(
      commissionTarget({ ...net(3, 5000), allocatedMinor: 3 }).targetMinor,
    ).toBe(2); // 1.5
    expect(
      commissionTarget({ ...net(7, 3333), allocatedMinor: 7 }).targetMinor,
    ).toBe(2); // 2.3331
  });

  it('net = 0 earns nothing, whatever was allocated', () => {
    expect(
      commissionTarget({ ...net(0, 4000), allocatedMinor: 5_000 }),
    ).toEqual({
      collectedMinor: 0,
      targetMinor: 0,
    });
  });

  it('caps collected at net and reverses on unapply', () => {
    expect(
      commissionTarget({ ...net(10_000, 4000), allocatedMinor: 15_000 }),
    ).toEqual({
      collectedMinor: 10_000,
      targetMinor: 4_000,
    });
    expect(entriesFor(net(10_000, 4000), [10_000, 0])).toEqual([4_000, -4_000]);
  });

  it('a discount after payment produces an adjustment', () => {
    // Paid 10,000 in full; discount lowers net to 8,000 and 2,000 goes to advance.
    const before = commissionTarget({
      ...net(10_000, 4000),
      allocatedMinor: 10_000,
    });
    const after = commissionTarget({
      ...net(8_000, 4000),
      allocatedMinor: 8_000,
    });
    expect(after.targetMinor - before.targetMinor).toBe(-800);
  });

  it('lab case: the rate applies to the price minus the lab cost (lab ERD §15 worked example)', () => {
    // Two crowns: patient 28,000 after discount, lab 10,000 → 40% of 18,000.
    const lab = { ...net(2_800_000, 4000), labCostMinor: 1_000_000 };
    expect(
      commissionTarget({ ...lab, allocatedMinor: 2_800_000 }).targetMinor,
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
        labCostMinor: 600_000,
        allocatedMinor: 500_000,
      }).targetMinor,
    ).toBe(0);
    expect(
      commissionTarget({
        netMinor: 500_000,
        grossMinor: 500_000,
        basis: CommissionBasis.NET,
        rateBps: null,
        fixedMinor: 50_000,
        labCostMinor: 200_000,
        allocatedMinor: 500_000,
      }).targetMinor,
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
        fixedAmountMinor: null,
      },
      {
        serviceId: 'svc-xray',
        serviceCategory: null,
        rateBps: null,
        fixedAmountMinor: 20_000,
      },
      {
        serviceId: null,
        serviceCategory: ServiceKind.CONSULTATION,
        rateBps: 6000,
        fixedAmountMinor: null,
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
      fixedMinor: null,
      source: 'SERVICE',
    });
    expect(
      resolveCommissionRate(plan, {
        serviceId: 'svc-other',
        serviceKind: ServiceKind.CONSULTATION,
      }),
    ).toEqual({
      rateBps: 6000,
      fixedMinor: null,
      source: 'CATEGORY',
    });
    expect(
      resolveCommissionRate(plan, {
        serviceId: null,
        serviceKind: ServiceKind.OTHER,
      }),
    ).toEqual({
      rateBps: 3000,
      fixedMinor: null,
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
      fixedMinor: 20_000,
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
              fixedAmountMinor: null,
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

  it('rupees → minor', () => {
    expect(rupeesToMinor('50000.5')).toBe(5_000_050);
    expect(rupeesToMinor(1200)).toBe(120_000);
    expect(rupeesToMinor(0.1)).toBe(10);
    expect(rupeesToMinor('0.07')).toBe(7);
    expect(rupeesToMinor('1.005')).toBeNull();
  });
});
