import { fromMinor, Minor, sumMinor, toMinor } from '../common/money';

/** Cash close math (D23, 6.20). Pure. */

export interface AccountWindowTotals {
  paymentAccountId: string;
  paymentAccountName: string;
  countedInCashClose: boolean;
  paymentsTotal: number;
  paymentCount: number;
  refundsTotal: number;
  refundCount: number;
}

export interface CashCloseLineCalc extends AccountWindowTotals {
  expected: number;
  counted: number | null;
  variance: number;
}

export interface CashCloseCalc {
  lines: CashCloseLineCalc[];
  totalExpected: number;
  totalCounted: number;
  totalVariance: number;
  /** Accounts that need a count but got none. */
  missingCounts: string[];
  hasVariance: boolean;
}

export function calculateCashClose(
  accounts: readonly AccountWindowTotals[],
  counted: ReadonlyMap<string, number | undefined>,
): CashCloseCalc {
  const missingCounts: string[] = [];
  const lines = accounts.map((a) => {
    const expected: Minor = toMinor(a.paymentsTotal) - toMinor(a.refundsTotal);
    const raw = counted.get(a.paymentAccountId);
    if (a.countedInCashClose && raw == null)
      missingCounts.push(a.paymentAccountName);
    const count = a.countedInCashClose && raw != null ? toMinor(raw) : null;
    return {
      ...a,
      expected: fromMinor(expected),
      counted: count === null ? null : fromMinor(count),
      variance: count === null ? 0 : fromMinor(count - expected),
    };
  });
  const variances = lines.map((l) => toMinor(l.variance));
  return {
    lines,
    totalExpected: fromMinor(sumMinor(lines.map((l) => toMinor(l.expected)))),
    totalCounted: fromMinor(
      sumMinor(lines.map((l) => toMinor(l.counted ?? 0))),
    ),
    totalVariance: fromMinor(sumMinor(variances)),
    missingCounts,
    hasVariance: variances.some((v) => v !== 0),
  };
}
