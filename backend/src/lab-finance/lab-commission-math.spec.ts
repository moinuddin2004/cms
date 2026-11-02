import { CommissionBasis } from 'src/billing/commissions/commission.enums';
import {
  LabLineCommissionInput,
  labLineCommissionTarget,
} from './lab-commission-math';

/** §15: two crowns at 15,000 − 1,000 discount each, lab 5,000 each, 40%. */
const crown = (over: Partial<LabLineCommissionInput> = {}) =>
  labLineCommissionTarget({
    lineTotalMinor: 1_400_000,
    taxMinor: 0,
    grossMinor: 1_500_000,
    invoiceTotalMinor: 2_800_000,
    creditedMinor: 0,
    allocatedMinor: 0,
    invoiceVoid: false,
    labCostMinor: 500_000,
    basis: CommissionBasis.NET,
    rateBps: 4000,
    fixedMinor: null,
    ...over,
  }).targetMinor;

describe('labLineCommissionTarget', () => {
  it('§15: fully paid → 40% of (14,000 − 5,000) per crown = 7,200 for the case', () => {
    expect(crown({ allocatedMinor: 2_800_000 }) * 2).toBe(720_000);
  });

  it('advance then the rest: cumulative, no drift', () => {
    const afterAdvance = crown({ allocatedMinor: 1_000_000 });
    // 5,000 of each line collected → 5,000 × 9,000 × 40% / 14,000
    expect(afterAdvance).toBe(128_571);
    expect(crown({ allocatedMinor: 2_800_000 })).toBe(360_000);
  });

  it('nothing collected (payment reversed) or void → 0', () => {
    expect(crown({ allocatedMinor: 0 })).toBe(0);
    expect(crown({ allocatedMinor: 2_800_000, invoiceVoid: true })).toBe(0);
  });

  it('a credit note shrinks the base; over-allocation is capped at net', () => {
    // 2,800 credited → each line's net 12,600; fully collected → 40% × 7,600
    expect(crown({ creditedMinor: 280_000, allocatedMinor: 2_520_000 })).toBe(
      304_000,
    );
    expect(crown({ creditedMinor: 280_000, allocatedMinor: 2_800_000 })).toBe(
      304_000,
    );
  });

  it('tax is not commissionable; lab cost above price floors at 0', () => {
    expect(
      crown({
        lineTotalMinor: 1_540_000,
        taxMinor: 140_000,
        invoiceTotalMinor: 3_080_000,
        allocatedMinor: 3_080_000,
      }),
    ).toBe(360_000);
    expect(crown({ labCostMinor: 2_000_000, allocatedMinor: 2_800_000 })).toBe(
      0,
    );
  });
});
