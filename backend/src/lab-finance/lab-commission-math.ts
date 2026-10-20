/**
 * Commission on one lab invoice line (lab ERD §6c, basis `net_of_lab_cost`,
 * "collected" basis). Pure: integer paisa in, integer paisa out.
 *
 * Lab allocations are per invoice, not per line, so a line's share is
 * proportional to its pre-tax amount (§6c "invoice line ke hisse ke
 * mutabiq"):
 *
 *   invoiceNet     = total − credited (0 when void)
 *   lineNet        = round(preTax × invoiceNet / total)
 *   lineCollected  = round(preTax × min(allocated, invoiceNet) / total)
 *
 * then billing v2's `commissionTarget` with the line's lab cost. Callers
 * insert `target − already recorded`, so installments never drift and a
 * payment reversal or credit note takes commission back by itself.
 */

import {
  commissionTarget,
  CommissionTarget,
  divRoundHalfUp,
} from 'src/billing/commissions/commission-math';
import { CommissionBasis } from 'src/billing/commissions/commission.enums';

export interface LabLineCommissionInput {
  /** qty × unit − discount + tax. */
  lineTotalPaisa: number;
  taxPaisa: number;
  /** qty × unit (before discount) — the GROSS basis price. */
  grossPaisa: number;
  invoiceTotalPaisa: number;
  creditedPaisa: number;
  /** Active (not reversed) allocations on the invoice. */
  allocatedPaisa: number;
  invoiceVoid: boolean;
  labCostPaisa: number;
  basis: CommissionBasis;
  rateBps: number | null;
  fixedPaisa: number | null;
}

export function labLineCommissionTarget(
  i: LabLineCommissionInput,
): CommissionTarget {
  const total = BigInt(Math.max(0, i.invoiceTotalPaisa));
  if (total === 0n || i.invoiceVoid)
    return { collectedPaisa: 0, targetPaisa: 0 };
  const invoiceNet = BigInt(
    Math.max(0, i.invoiceTotalPaisa - Math.max(0, i.creditedPaisa)),
  );
  const collected = BigInt(
    Math.min(Math.max(0, i.allocatedPaisa), Number(invoiceNet)),
  );
  const preTax = BigInt(Math.max(0, i.lineTotalPaisa - i.taxPaisa));
  const lineNet = divRoundHalfUp(preTax * invoiceNet, total);
  const lineCollected = divRoundHalfUp(preTax * collected, total);
  return commissionTarget({
    allocatedPaisa: Number(lineCollected),
    netPaisa: Number(lineNet),
    grossPaisa: i.grossPaisa,
    basis: i.basis,
    rateBps: i.rateBps,
    fixedPaisa: i.fixedPaisa,
    labCostPaisa: i.labCostPaisa,
  });
}
