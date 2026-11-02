import { AllocationMode } from '../../enums/billing.enums';
import {
  AllocationPlanError,
  NEW_PAYMENT,
  planAllocation,
  PlannerCharge,
} from './allocation-planner';

// Consultation 1,200 + Scaling 3,000 on day 1, Filling 1,800 on day 2 (12.2).
const charges: PlannerCharge[] = [
  {
    id: 'filling',
    chargeDate: '2026-10-02',
    createdAt: 3,
    balanceMinor: 180000,
  },
  {
    id: 'consult',
    chargeDate: '2026-10-01',
    createdAt: 1,
    balanceMinor: 120000,
  },
  {
    id: 'scaling',
    chargeDate: '2026-10-01',
    createdAt: 2,
    balanceMinor: 300000,
  },
];

describe('planAllocation', () => {
  it('AUTO: Rs 5,800 pays FIFO and leaves Rs 200 on the filling (S1)', () => {
    const plan = planAllocation(AllocationMode.AUTO, {
      charges,
      funds: [{ source: NEW_PAYMENT, availableMinor: 580000 }],
    });
    expect(plan.lines.map((l) => [l.chargeId, l.amountMinor])).toEqual([
      ['consult', 120000],
      ['scaling', 300000],
      ['filling', 160000],
    ]);
    expect(plan.newPaymentAdvanceMinor).toBe(0);
  });

  it('AUTO: overpayment becomes advance (S2)', () => {
    const plan = planAllocation(AllocationMode.AUTO, {
      charges,
      funds: [{ source: NEW_PAYMENT, availableMinor: 700000 }],
    });
    expect(plan.newPaymentAdvanceMinor).toBe(100000);
  });

  it('uses old advance before new money (S4)', () => {
    const plan = planAllocation(AllocationMode.AUTO, {
      charges: [
        {
          id: 'c',
          chargeDate: '2026-10-01',
          createdAt: 1,
          balanceMinor: 300000,
        },
      ],
      funds: [
        { source: 'old-payment', availableMinor: 100000 },
        { source: NEW_PAYMENT, availableMinor: 200000 },
      ],
    });
    expect(plan.lines).toEqual([
      { chargeId: 'c', source: 'old-payment', amountMinor: 100000 },
      { chargeId: 'c', source: NEW_PAYMENT, amountMinor: 200000 },
    ]);
    expect(plan.advanceUsedMinor).toBe(100000);
  });

  it('pure deposit: no charges, everything is advance (S3)', () => {
    const plan = planAllocation(AllocationMode.AUTO, {
      charges: [],
      funds: [{ source: NEW_PAYMENT, availableMinor: 500000 }],
    });
    expect(plan.lines).toEqual([]);
    expect(plan.newPaymentAdvanceMinor).toBe(500000);
  });

  it('MANUAL: rejects amount > balance and sum > funds (S5)', () => {
    const funds = [{ source: NEW_PAYMENT, availableMinor: 100000 }];
    expect(() =>
      planAllocation(AllocationMode.MANUAL, {
        charges,
        funds,
        requested: new Map([['consult', 130000]]),
      }),
    ).toThrow(AllocationPlanError);
    expect(() =>
      planAllocation(AllocationMode.MANUAL, {
        charges,
        funds,
        requested: new Map([
          ['consult', 60000],
          ['scaling', 60000],
        ]),
      }),
    ).toThrow(
      expect.objectContaining({ code: 'BILLING_ALLOCATION_EXCEEDS_FUNDS' }),
    );
  });

  it('MANUAL: honours the requested split', () => {
    const plan = planAllocation(AllocationMode.MANUAL, {
      charges,
      funds: [{ source: NEW_PAYMENT, availableMinor: 100000 }],
      requested: new Map([['filling', 100000]]),
    });
    expect(plan.lines).toEqual([
      { chargeId: 'filling', source: NEW_PAYMENT, amountMinor: 100000 },
    ]);
  });
});
