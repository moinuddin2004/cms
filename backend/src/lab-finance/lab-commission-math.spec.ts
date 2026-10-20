import { CommissionBasis } from 'src/billing/commissions/commission.enums';
import {
  LabLineCommissionInput,
  labLineCommissionTarget,
} from './lab-commission-math';

/** §15: two crowns at 15,000 − 1,000 discount each, lab 5,000 each, 40%. */
const crown = (over: Partial<LabLineCommissionInput> = {}) =>
  labLineCommissionTarget({
    lineTotalPaisa: 1_400_000,
    taxPaisa: 0,
    grossPaisa: 1_500_000,
    invoiceTotalPaisa: 2_800_000,
    creditedPaisa: 0,
    allocatedPaisa: 0,
    invoiceVoid: false,
    labCostPaisa: 500_000,
    basis: CommissionBasis.NET,
    rateBps: 4000,
    fixedPaisa: null,
    ...over,
  }).targetPaisa;

describe('labLineCommissionTarget', () => {
  it('§15: fully paid → 40% of (14,000 − 5,000) per crown = 7,200 for the case', () => {
    expect(crown({ allocatedPaisa: 2_800_000 }) * 2).toBe(720_000);
  });

  it('advance then the rest: cumulative, no drift', () => {
    const afterAdvance = crown({ allocatedPaisa: 1_000_000 });
    // 5,000 of each line collected → 5,000 × 9,000 × 40% / 14,000
    expect(afterAdvance).toBe(128_571);
    expect(crown({ allocatedPaisa: 2_800_000 })).toBe(360_000);
  });

  it('nothing collected (payment reversed) or void → 0', () => {
    expect(crown({ allocatedPaisa: 0 })).toBe(0);
    expect(crown({ allocatedPaisa: 2_800_000, invoiceVoid: true })).toBe(0);
  });

  it('a credit note shrinks the base; over-allocation is capped at net', () => {
    // 2,800 credited → each line's net 12,600; fully collected → 40% × 7,600
    expect(crown({ creditedPaisa: 280_000, allocatedPaisa: 2_520_000 })).toBe(
      304_000,
    );
    expect(crown({ creditedPaisa: 280_000, allocatedPaisa: 2_800_000 })).toBe(
      304_000,
    );
  });

  it('tax is not commissionable; lab cost above price floors at 0', () => {
    expect(
      crown({
        lineTotalPaisa: 1_540_000,
        taxPaisa: 140_000,
        invoiceTotalPaisa: 3_080_000,
        allocatedPaisa: 3_080_000,
      }),
    ).toBe(360_000);
    expect(crown({ labCostPaisa: 2_000_000, allocatedPaisa: 2_800_000 })).toBe(
      0,
    );
  });
});
