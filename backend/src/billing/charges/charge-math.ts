import { fromMinor, lineGross, percentOf, toMinor } from '../common/money';
import { Charge } from '../entities/charge.entity';
import { ChargeStatus, DiscountKind } from '../enums/billing.enums';
import { ResolvedDiscount } from '../discounts/discount-policy';
import { chargePayableMinor } from '../tax/invoice-tax';

/**
 * In-memory charge arithmetic shared by charge routes and invoice-edit
 * commands. Callers save the charge afterwards; the cached
 * `allocatedAmount` is never touched here (BillingTotalsService owns it).
 */

/**
 * gross = qty × price; net = gross − discount. A percentage discount
 * follows the new gross; a fixed one keeps its amount, capped by gross.
 */
export function recalcCharge(charge: Charge): void {
  const gross = lineGross(charge.quantity, charge.unitPrice);
  let discount = toMinor(charge.discountAmount);
  if (
    charge.discountKind === DiscountKind.PERCENTAGE &&
    charge.discountValue != null
  ) {
    discount = percentOf(gross, charge.discountValue);
  }
  discount = Math.max(0, Math.min(discount, gross));
  charge.grossAmount = fromMinor(gross);
  charge.discountAmount = fromMinor(discount);
  charge.netAmount = fromMinor(gross - discount);
}

/** Exactly one discount per charge; a new one replaces the old (D8). */
export function applyDiscount(
  charge: Charge,
  discount: ResolvedDiscount,
  amountMinor: number,
  actorId: string,
): void {
  charge.discountTypeId = discount.typeId;
  charge.discountName = discount.name;
  charge.discountKind = discount.rule.kind;
  charge.discountValue = discount.rule.value;
  charge.discountNote = discount.note;
  charge.discountAppliedBy = actorId;
  charge.isCustomDiscount = discount.isCustom;
  const gross = lineGross(charge.quantity, charge.unitPrice);
  const amount = Math.max(0, Math.min(amountMinor, gross));
  charge.grossAmount = fromMinor(gross);
  charge.discountAmount = fromMinor(amount);
  charge.netAmount = fromMinor(gross - amount);
}

export function clearDiscount(charge: Charge): void {
  charge.discountTypeId = null;
  charge.discountName = null;
  charge.discountKind = null;
  charge.discountValue = null;
  charge.discountNote = null;
  charge.discountAppliedBy = null;
  charge.isCustomDiscount = false;
  charge.discountAmount = 0;
  recalcCharge(charge);
}

export function voidCharge(
  charge: Charge,
  reason: string,
  actorId: string,
  at: Date,
): void {
  charge.status = ChargeStatus.VOID;
  charge.voidedAt = at;
  charge.voidedBy = actorId;
  charge.voidReason = reason;
}

/** Charge balance in minor units: net + tax − allocated (VOID = 0). */
export const chargeBalanceMinor = (
  c: Pick<Charge, 'status' | 'netAmount' | 'taxAmount' | 'allocatedAmount'>,
): number =>
  c.status === ChargeStatus.VOID
    ? 0
    : chargePayableMinor(c) - toMinor(c.allocatedAmount);

/** Plain snapshot for audit rows (no relations, no Date objects lost). */
export function chargeSnapshot(c: Charge): Record<string, unknown> {
  const snapshot: Record<string, unknown> = { ...c };
  delete snapshot.patient;
  delete snapshot.invoice;
  delete snapshot.doctor;
  // Commission is an internal clinic cost: audit snapshots are shown on
  // invoice revisions / prints and the activity log, so they never carry it.
  delete snapshot.performingAssignment;
  delete snapshot.performingAssignmentId;
  delete snapshot.commissionPlan;
  delete snapshot.commissionPlanId;
  delete snapshot.commissionRateBps;
  delete snapshot.commissionFixedMinor;
  return snapshot;
}
