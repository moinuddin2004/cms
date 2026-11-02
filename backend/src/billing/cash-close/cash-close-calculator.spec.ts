import {
  AccountWindowTotals,
  calculateCashClose,
} from './cash-close-calculator';

const account = (
  over: Partial<AccountWindowTotals> & { paymentAccountId: string },
): AccountWindowTotals => ({
  paymentAccountName: over.paymentAccountId,
  countedInCashClose: true,
  paymentsTotal: 0,
  paymentCount: 0,
  refundsTotal: 0,
  refundCount: 0,
  ...over,
});

describe('calculateCashClose', () => {
  it('expected = payments − refunds; variance = counted − expected', () => {
    const r = calculateCashClose(
      [
        account({
          paymentAccountId: 'cash',
          paymentsTotal: 1000,
          refundsTotal: 200,
        }),
      ],
      new Map([['cash', 790]]),
    );
    expect(r.lines[0].expected).toBe(800);
    expect(r.lines[0].variance).toBe(-10);
    expect(r.totalVariance).toBe(-10);
    expect(r.hasVariance).toBe(true);
    expect(r.missingCounts).toEqual([]);
  });

  it('reports no variance on an exact count', () => {
    const r = calculateCashClose(
      [account({ paymentAccountId: 'cash', paymentsTotal: 500 })],
      new Map([['cash', 500]]),
    );
    expect(r.hasVariance).toBe(false);
    expect(r.totalCounted).toBe(500);
  });

  it('flags accounts that need a count but got none', () => {
    const r = calculateCashClose(
      [
        account({
          paymentAccountId: 'cash',
          paymentAccountName: 'Cash',
          paymentsTotal: 100,
        }),
      ],
      new Map(),
    );
    expect(r.missingCounts).toEqual(['Cash']);
    expect(r.lines[0].counted).toBeNull();
    expect(r.lines[0].variance).toBe(0);
  });

  it('ignores counts for accounts outside the cash close (cards, bank)', () => {
    const r = calculateCashClose(
      [
        account({
          paymentAccountId: 'card',
          countedInCashClose: false,
          paymentsTotal: 900,
        }),
      ],
      new Map([['card', 1]]),
    );
    expect(r.missingCounts).toEqual([]);
    expect(r.lines[0].counted).toBeNull();
    expect(r.totalExpected).toBe(900);
    expect(r.totalCounted).toBe(0);
    expect(r.hasVariance).toBe(false);
  });

  it('sums in minor units, so 0.1 + 0.2 style drift cannot appear', () => {
    const r = calculateCashClose(
      [
        account({ paymentAccountId: 'a', paymentsTotal: 0.1 }),
        account({ paymentAccountId: 'b', paymentsTotal: 0.2 }),
      ],
      new Map([
        ['a', 0.1],
        ['b', 0.2],
      ]),
    );
    expect(r.totalExpected).toBe(0.3);
    expect(r.totalVariance).toBe(0);
  });
});
