import {
  basisPointsOf,
  fromPaisa,
  Paisa,
  percentToBasisPoints,
  splitProportionally,
  sumPaisa,
  toPaisa,
} from '../common/money';
import { ChargeStatus } from '../enums/billing.enums';

/**
 * Sales tax on patient invoices. EXCLUSIVE: prices are pre-tax and
 *
 *   tax   = round_half_up(taxable × rate / 100), taxable = Σ ACTIVE net
 *           (subtotal after discounts)
 *   total = subtotal − discount + tax
 *
 * The rate is snapshotted on the invoice (`invoices.tax_rate`) from the
 * location's settings when it is issued; edits re-apply the SNAPSHOT rate,
 * never the current setting. Payments are allocated per charge, so the
 * invoice tax is spread over its ACTIVE charges (`charges.tax_amount`) and
 * a charge is payable up to net + tax. Tax is never revenue and never earns
 * commission (see `preTaxPaisa`). Pure: no NestJS / TypeORM imports.
 */

export interface TaxableCharge {
  status: ChargeStatus;
  netAmount: number;
  taxAmount: number;
}

/** Tax on a taxable amount (paisa) at `ratePercent` (e.g. 17 or 17.5). */
export const taxOnPaisa = (
  taxablePaisa: Paisa,
  ratePercent: number | string | null | undefined,
): Paisa => basisPointsOf(taxablePaisa, percentToBasisPoints(ratePercent));

/** Invoice tax for these charges: on the sum of ACTIVE nets, rounded once. */
export const invoiceTaxPaisa = (
  charges: readonly TaxableCharge[],
  ratePercent: number | string | null | undefined,
): Paisa =>
  taxOnPaisa(
    sumPaisa(
      charges
        .filter((c) => c.status === ChargeStatus.ACTIVE)
        .map((c) => toPaisa(c.netAmount)),
    ),
    ratePercent,
  );

/**
 * Per-charge shares of the invoice tax. Each ACTIVE charge gets the tax on
 * its own net; the rounding difference to the invoice tax goes to the
 * largest charge, so a charge's share stays stable when other lines change.
 * (Falls back to a proportional split in the degenerate case where that
 * would make the largest share negative.) VOID charges get 0.
 */
export function splitInvoiceTax(
  charges: readonly TaxableCharge[],
  ratePercent: number | string | null | undefined,
): Paisa[] {
  const bp = percentToBasisPoints(ratePercent);
  const nets = charges.map((c) =>
    c.status === ChargeStatus.ACTIVE ? Math.max(0, toPaisa(c.netAmount)) : 0,
  );
  if (bp === 0) return nets.map(() => 0);
  const total = basisPointsOf(sumPaisa(nets), bp);
  const shares = nets.map((n) => basisPointsOf(n, bp));
  const diff = total - sumPaisa(shares);
  if (diff === 0) return shares;
  let largest = 0;
  nets.forEach((n, i) => {
    if (n > nets[largest]) largest = i;
  });
  if (shares[largest] + diff >= 0) {
    shares[largest] += diff;
    return shares;
  }
  return splitProportionally(total, nets);
}

/**
 * Writes `taxAmount` on every charge in memory (VOID → 0) and returns the
 * invoice tax in paisa. Callers persist the charges.
 */
export function applyInvoiceTax<T extends TaxableCharge>(
  charges: readonly T[],
  ratePercent: number | string | null | undefined,
): Paisa {
  const shares = splitInvoiceTax(charges, ratePercent);
  charges.forEach((c, i) => (c.taxAmount = fromPaisa(shares[i])));
  return sumPaisa(shares);
}

/** What the patient owes on a charge: net + tax (VOID = 0), in paisa. */
export const chargePayablePaisa = (
  c: Pick<TaxableCharge, 'status' | 'netAmount' | 'taxAmount'>,
): Paisa =>
  c.status === ChargeStatus.VOID
    ? 0
    : toPaisa(c.netAmount) + toPaisa(c.taxAmount ?? 0);

/**
 * The pre-tax part of money collected on a charge: allocations cover net
 * and tax pro rata, so collected × net / (net + tax), half-up, capped at
 * net. Tax 0 → the collected amount itself (capped at net).
 */
export function preTaxPaisa(
  collectedPaisa: Paisa,
  netPaisa: Paisa,
  taxPaisa: Paisa,
): Paisa {
  const net = Math.max(0, netPaisa);
  const collected = Math.max(0, collectedPaisa);
  if (net === 0 || collected === 0) return 0;
  const tax = Math.max(0, taxPaisa);
  if (tax === 0) return Math.min(collected, net);
  const n = BigInt(collected) * BigInt(net);
  const d = BigInt(net + tax);
  return Math.min(Number((2n * n + d) / (2n * d)), net);
}

/**
 * SQL for the pre-tax part of an allocation `pa` on charge `c` (rupees,
 * numeric). Same rule as `preTaxPaisa`; for revenue reports, where tax is
 * not clinic revenue.
 */
export const preTaxAllocationSql = (pa = 'pa', c = 'c'): string =>
  `(CASE WHEN ${c}.tax_amount = 0 OR ${c}.net_amount + ${c}.tax_amount = 0 THEN ${pa}.amount
         ELSE ROUND(${pa}.amount * ${c}.net_amount / (${c}.net_amount + ${c}.tax_amount), 2) END)`;
