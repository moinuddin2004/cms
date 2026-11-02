/**
 * Commission on one lab invoice line (lab ERD §6c, basis `net_of_lab_cost`,
 * "collected" basis). Pure: integer minor units in, integer minor units out.
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
  lineTotalMinor: number;
  taxMinor: number;
  /** qty × unit (before discount) — the GROSS basis price. */
  grossMinor: number;
  invoiceTotalMinor: number;
  creditedMinor: number;
  /** Active (not reversed) allocations on the invoice. */
  allocatedMinor: number;
  invoiceVoid: boolean;
  labCostMinor: number;
  basis: CommissionBasis;
  rateBps: number | null;
  fixedMinor: number | null;
}

export function labLineCommissionTarget(
  i: LabLineCommissionInput,
): CommissionTarget {
  const total = BigInt(Math.max(0, i.invoiceTotalMinor));
  if (total === 0n || i.invoiceVoid)
    return { collectedMinor: 0, targetMinor: 0 };
  const invoiceNet = BigInt(
    Math.max(0, i.invoiceTotalMinor - Math.max(0, i.creditedMinor)),
  );
  const collected = BigInt(
    Math.min(Math.max(0, i.allocatedMinor), Number(invoiceNet)),
  );
  const preTax = BigInt(Math.max(0, i.lineTotalMinor - i.taxMinor));
  const lineNet = divRoundHalfUp(preTax * invoiceNet, total);
  const lineCollected = divRoundHalfUp(preTax * collected, total);
  return commissionTarget({
    allocatedMinor: Number(lineCollected),
    netMinor: Number(lineNet),
    grossMinor: i.grossMinor,
    basis: i.basis,
    rateBps: i.rateBps,
    fixedMinor: i.fixedMinor,
    labCostMinor: i.labCostMinor,
  });
}
