import { fromPaisa, lineGross, percentOf, toPaisa } from '../common/money';
import { Charge } from '../entities/charge.entity';
import { ChargeStatus, DiscountKind } from '../enums/billing.enums';
import { ResolvedDiscount } from '../discounts/discount-policy';

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
  let discount = toPaisa(charge.discountAmount);
  if (
    charge.discountKind === DiscountKind.PERCENTAGE &&
    charge.discountValue != null
  ) {
    discount = percentOf(gross, charge.discountValue);
  }
  discount = Math.max(0, Math.min(discount, gross));
  charge.grossAmount = fromPaisa(gross);
  charge.discountAmount = fromPaisa(discount);
  charge.netAmount = fromPaisa(gross - discount);
}

/** Exactly one discount per charge; a new one replaces the old (D8). */
export function applyDiscount(
  charge: Charge,
  discount: ResolvedDiscount,
  amountPaisa: number,
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
  const amount = Math.max(0, Math.min(amountPaisa, gross));
  charge.grossAmount = fromPaisa(gross);
  charge.discountAmount = fromPaisa(amount);
  charge.netAmount = fromPaisa(gross - amount);
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

/** Charge balance in paisa (VOID = 0). */
export const chargeBalancePaisa = (
  c: Pick<Charge, 'status' | 'netAmount' | 'allocatedAmount'>,
): number =>
  c.status === ChargeStatus.VOID
    ? 0
    : toPaisa(c.netAmount) - toPaisa(c.allocatedAmount);

/** Plain snapshot for audit rows (no relations, no Date objects lost). */
export function chargeSnapshot(c: Charge): Record<string, unknown> {
  const snapshot: Record<string, unknown> = { ...c };
  delete snapshot.patient;
  delete snapshot.invoice;
  delete snapshot.doctor;
  return snapshot;
}
