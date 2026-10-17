import { CUSTOM_DISCOUNT_NAME, NOTE_MIN_LENGTH } from '../billing.constants';
import { BillingActor } from '../common/billing-context';
import { billingError } from '../common/billing-errors';
import { toPaisa } from '../common/money';
import { DiscountType } from '../entities/discount-type.entity';
import { DiscountKind } from '../enums/billing.enums';
import { DiscountRule } from './calculator/discount-calculator';
import { isDiscountUsable, isValueInKindBounds } from './applicability';

/** What the client asks for (6.3): a type, or a custom discount (admin). */
export interface DiscountRequest {
  discountTypeId?: string | null;
  kind?: DiscountKind;
  value?: number;
  note?: string | null;
}

/** A validated discount ready to be snapshotted on charges. */
export interface ResolvedDiscount {
  typeId: string | null;
  name: string;
  isCustom: boolean;
  note: string | null;
  rule: DiscountRule;
}

/**
 * Role and type rules of D8 / 6.3, steps 1, 3, 4 and 5. Applicability to a
 * specific charge (step 2) is checked per charge by the caller.
 */
export function resolveDiscount(
  req: DiscountRequest,
  type: DiscountType | null,
  actor: BillingActor,
  today: string,
): ResolvedDiscount {
  const note = req.note?.trim() || null;

  if (!type) {
    if (!actor.isAdmin) {
      throw billingError(
        'BILLING_CUSTOM_DISCOUNT_ADMIN_ONLY',
        'Only an admin can give a custom discount',
      );
    }
    if (
      !req.kind ||
      req.value == null ||
      !isValueInKindBounds(req.kind, req.value)
    ) {
      throw billingError(
        'BILLING_DISCOUNT_INVALID',
        'A custom discount needs a kind and a valid value',
      );
    }
    assertNote(note, 'Add a reason for the custom discount');
    return {
      typeId: null,
      name: CUSTOM_DISCOUNT_NAME,
      isCustom: true,
      note,
      rule: { kind: req.kind, value: req.value, maxAmount: null },
    };
  }

  if (!isDiscountUsable(type, today)) {
    throw billingError(
      'BILLING_DISCOUNT_INVALID',
      `${type.name} is not available today`,
    );
  }
  const value = req.value ?? type.value;
  if (toPaisa(value) !== toPaisa(type.value))
    assertValueAllowed(type, value, actor);
  if (type.requiresNote) assertNote(note, `${type.name} needs a note`);

  return {
    typeId: type.id,
    name: type.name,
    isCustom: false,
    note,
    rule: { kind: type.kind, value, maxAmount: type.maxAmount },
  };
}

function assertValueAllowed(
  type: DiscountType,
  value: number,
  actor: BillingActor,
): void {
  if (!isValueInKindBounds(type.kind, value)) {
    throw billingError(
      'BILLING_DISCOUNT_VALUE_NOT_ALLOWED',
      'This discount value is out of range',
    );
  }
  if (actor.isAdmin) return;
  const inRange =
    type.receptionEditable &&
    type.minValue != null &&
    type.maxValue != null &&
    value >= type.minValue &&
    value <= type.maxValue;
  if (!inRange) {
    throw billingError(
      'BILLING_DISCOUNT_VALUE_NOT_ALLOWED',
      type.receptionEditable
        ? `Value must be between ${type.minValue} and ${type.maxValue}`
        : `The value of ${type.name} cannot be changed`,
    );
  }
}

function assertNote(note: string | null, message: string): void {
  if (!note || note.length < NOTE_MIN_LENGTH) {
    throw billingError('BILLING_DISCOUNT_NOTE_REQUIRED', message);
  }
}
