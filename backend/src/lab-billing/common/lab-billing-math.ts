import { LabInvoiceStatus } from '../enums/lab-billing.enums';

/**
 * Pure money rules for lab billing (lab ERD §1, §19): integer paisa,
 * tax in basis points, half-up rounding per line. No floats anywhere.
 */

/** round_half_up(value × bp / 10 000) for value, bp ≥ 0 — exact (BigInt). */
export function bpOf(valuePaisa: number, bp: number): number {
  const v = BigInt(valuePaisa) * BigInt(bp);
  return Number((v + 5000n) / 10000n);
}

export interface LineInput {
  quantity: number;
  unitPricePaisa: number;
  discountPaisa: number;
  taxRateBp: number;
}

export interface LineMoney {
  grossPaisa: number;
  netPaisa: number;
  taxPaisa: number;
  lineTotalPaisa: number;
}

export class LineMathError extends Error {}

/** gross = qty × unit; net = gross − discount; tax on net (half-up); total = net + tax. */
export function lineMath(l: LineInput): LineMoney {
  for (const v of [l.quantity, l.unitPricePaisa, l.discountPaisa, l.taxRateBp])
    if (!Number.isSafeInteger(v) || v < 0)
      throw new LineMathError('Amounts must be whole, non-negative paisa');
  if (l.quantity < 1) throw new LineMathError('Quantity must be at least 1');
  if (l.taxRateBp > 10_000) throw new LineMathError('Tax rate is over 100%');
  const grossPaisa = l.quantity * l.unitPricePaisa;
  if (l.discountPaisa > grossPaisa)
    throw new LineMathError('Discount is more than the line amount');
  const netPaisa = grossPaisa - l.discountPaisa;
  const taxPaisa = bpOf(netPaisa, l.taxRateBp);
  return {
    grossPaisa,
    netPaisa,
    taxPaisa,
    lineTotalPaisa: netPaisa + taxPaisa,
  };
}

/**
 * Splits an invoice-level discount over lines in proportion to their gross
 * (largest remainder, ties to the earlier line), never above a line's gross.
 */
export function spreadDiscount(
  grossPaisa: number[],
  discount: number,
): number[] {
  const total = grossPaisa.reduce((a, g) => a + g, 0);
  if (discount <= 0 || total === 0) return grossPaisa.map(() => 0);
  if (discount > total)
    throw new LineMathError('Discount is more than the invoice amount');
  const exact = grossPaisa.map((g) => BigInt(g) * BigInt(discount));
  const shares = exact.map((e) => Number(e / BigInt(total)));
  let left = discount - shares.reduce((a, s) => a + s, 0);
  const order = exact
    .map((e, i) => ({ i, rem: e % BigInt(total) }))
    .sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : a.i - b.i));
  for (const { i } of order) {
    if (left === 0) break;
    if (shares[i] < grossPaisa[i]) {
      shares[i] += 1;
      left -= 1;
    }
  }
  return shares;
}

/**
 * The stored status of an invoice from its cached totals. Draft and void
 * are document states and stay as they are.
 */
export function invoiceStatusFor(inv: {
  status: LabInvoiceStatus;
  paidPaisa: number;
  balancePaisa: number;
}): LabInvoiceStatus {
  if (
    inv.status === LabInvoiceStatus.DRAFT ||
    inv.status === LabInvoiceStatus.VOID
  )
    return inv.status;
  if (inv.balancePaisa === 0) return LabInvoiceStatus.PAID;
  if (inv.paidPaisa > 0) return LabInvoiceStatus.PARTIALLY_PAID;
  return LabInvoiceStatus.ISSUED;
}

export interface OpenInvoice {
  id: string;
  balancePaisa: number;
}

/**
 * Oldest-first: fills each invoice's balance from `amountPaisa`. Returns
 * only non-zero allocations. The caller passes invoices in FIFO order.
 */
export function fifoAllocations(
  invoices: OpenInvoice[],
  amountPaisa: number,
): Array<{ invoiceId: string; amountPaisa: number }> {
  const out: Array<{ invoiceId: string; amountPaisa: number }> = [];
  let left = amountPaisa;
  for (const inv of invoices) {
    if (left <= 0) break;
    const take = Math.min(left, inv.balancePaisa);
    if (take > 0) {
      out.push({ invoiceId: inv.id, amountPaisa: take });
      left -= take;
    }
  }
  return out;
}

/** "PKR 10,000" / "PKR 10,000.50" — for messages and receipts. */
export function formatPkr(paisa: number, currency = 'PKR'): string {
  const sign = paisa < 0 ? '-' : '';
  const abs = Math.abs(paisa);
  const rupees = Math.floor(abs / 100).toLocaleString('en-US');
  const rest = abs % 100;
  return `${sign}${currency} ${rupees}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`;
}
