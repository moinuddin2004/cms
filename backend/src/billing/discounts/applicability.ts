import {
  DiscountAppliesTo,
  DiscountKind,
  ServiceKind,
} from '../enums/billing.enums';

/**
 * Small composable predicates over discount types (Specification, 13.5).
 * Pure: plain objects in, booleans out.
 */
export interface DiscountTypeSpec {
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  appliesTo: DiscountAppliesTo;
  serviceKinds: ServiceKind[] | null;
  serviceIds: string[] | null;
}

export interface ChargeSpec {
  serviceId: string | null;
  serviceKind: ServiceKind;
}

export const isValidOn = (
  t: Pick<DiscountTypeSpec, 'validFrom' | 'validTo'>,
  today: string,
): boolean =>
  (!t.validFrom || t.validFrom <= today) && (!t.validTo || today <= t.validTo);

export const isDiscountUsable = (t: DiscountTypeSpec, today: string): boolean =>
  t.isActive && isValidOn(t, today);

export function appliesToCharge(t: DiscountTypeSpec, c: ChargeSpec): boolean {
  switch (t.appliesTo) {
    case DiscountAppliesTo.ALL:
      return true;
    case DiscountAppliesTo.SERVICE_KINDS:
      return (t.serviceKinds ?? []).includes(
        c.serviceId ? c.serviceKind : ServiceKind.OTHER,
      );
    case DiscountAppliesTo.SERVICES:
      return !!c.serviceId && (t.serviceIds ?? []).includes(c.serviceId);
  }
}

/** Allowed value range for a kind, regardless of role. */
export const isValueInKindBounds = (
  kind: DiscountKind,
  value: number,
): boolean =>
  kind === DiscountKind.PERCENTAGE ? value > 0 && value <= 100 : value > 0;
