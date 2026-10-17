import { fromPaisa, Paisa, sumPaisa, toPaisa } from '../common/money';

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
    const expected: Paisa = toPaisa(a.paymentsTotal) - toPaisa(a.refundsTotal);
    const raw = counted.get(a.paymentAccountId);
    if (a.countedInCashClose && raw == null)
      missingCounts.push(a.paymentAccountName);
    const count = a.countedInCashClose && raw != null ? toPaisa(raw) : null;
    return {
      ...a,
      expected: fromPaisa(expected),
      counted: count === null ? null : fromPaisa(count),
      variance: count === null ? 0 : fromPaisa(count - expected),
    };
  });
  const variances = lines.map((l) => toPaisa(l.variance));
  return {
    lines,
    totalExpected: fromPaisa(sumPaisa(lines.map((l) => toPaisa(l.expected)))),
    totalCounted: fromPaisa(
      sumPaisa(lines.map((l) => toPaisa(l.counted ?? 0))),
    ),
    totalVariance: fromPaisa(sumPaisa(variances)),
    missingCounts,
    hasVariance: variances.some((v) => v !== 0),
  };
}
