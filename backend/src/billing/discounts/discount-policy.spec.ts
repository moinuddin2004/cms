import { HttpException } from '@nestjs/common';
import { ACCESS_POLICIES } from 'src/access/access-context';
import { testActor } from '../common/billing-access.testing';
import { DiscountType } from '../entities/discount-type.entity';
import { DiscountAppliesTo, DiscountKind } from '../enums/billing.enums';
import { resolveDiscount } from './discount-policy';

const TODAY = '2026-10-22';

/** A 10% preset reception may change between 5 and 15. */
const senior = (over: Partial<DiscountType> = {}): DiscountType =>
  ({
    id: 'type-1',
    name: 'Senior citizen',
    kind: DiscountKind.PERCENTAGE,
    value: 10,
    minValue: 5,
    maxValue: 15,
    maxAmount: null,
    receptionEditable: true,
    requiresNote: false,
    isActive: true,
    validFrom: null,
    validTo: null,
    appliesTo: DiscountAppliesTo.ALL,
    serviceKinds: null,
    serviceIds: null,
    ...over,
  }) as DiscountType;

const preset = { 'billing.discount.apply': true } as const;
const custom = { 'billing.discount.custom': true } as const;

/** The billing error code (or access code) a call fails with. */
function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    const body = (e as HttpException).getResponse() as { code?: string };
    return body.code;
  }
  return undefined;
}

describe('resolveDiscount — billing.discount.apply / .custom', () => {
  afterEach(() => ACCESS_POLICIES.delete('billing.discount.apply'));

  it('applies a preset at its own value with billing.discount.apply', () => {
    const out = resolveDiscount(
      { discountTypeId: 'type-1' },
      senior(),
      testActor(preset),
      TODAY,
    );
    expect(out.rule.value).toBe(10);
    expect(out.isCustom).toBe(false);
  });

  it('allows a changed value inside the range', () => {
    const out = resolveDiscount(
      { discountTypeId: 'type-1', value: 15 },
      senior(),
      testActor(preset),
      TODAY,
    );
    expect(out.rule.value).toBe(15);
  });

  it('denies a value outside the range without billing.discount.custom', () => {
    expect(
      codeOf(() =>
        resolveDiscount(
          { discountTypeId: 'type-1', value: 30 },
          senior(),
          testActor(preset),
          TODAY,
        ),
      ),
    ).toBe('BILLING_DISCOUNT_VALUE_NOT_ALLOWED');
  });

  it('denies any change of a preset reception may not edit', () => {
    expect(
      codeOf(() =>
        resolveDiscount(
          { discountTypeId: 'type-1', value: 12 },
          senior({ receptionEditable: false }),
          testActor(preset),
          TODAY,
        ),
      ),
    ).toBe('BILLING_DISCOUNT_VALUE_NOT_ALLOWED');
  });

  it('billing.discount.custom lifts the range (escalation)', () => {
    const out = resolveDiscount(
      { discountTypeId: 'type-1', value: 30 },
      senior(),
      testActor(custom),
      TODAY,
    );
    expect(out.rule.value).toBe(30);
  });

  it('still rejects values outside the kind bounds, even with custom', () => {
    expect(
      codeOf(() =>
        resolveDiscount(
          { discountTypeId: 'type-1', value: 120 },
          senior(),
          testActor(custom),
          TODAY,
        ),
      ),
    ).toBe('BILLING_DISCOUNT_VALUE_NOT_ALLOWED');
  });

  it('refuses even a preset without any discount permission (403)', () => {
    expect(
      codeOf(() =>
        resolveDiscount(
          { discountTypeId: 'type-1' },
          senior(),
          testActor({ 'billing.desk.use': true }),
          TODAY,
        ),
      ),
    ).toBe('NO_PERMISSION');
  });

  it('a custom discount needs billing.discount.custom', () => {
    const req = {
      kind: DiscountKind.FIXED,
      value: 500,
      note: 'Family of staff',
    };
    expect(
      codeOf(() => resolveDiscount(req, null, testActor(preset), TODAY)),
    ).toBe('BILLING_CUSTOM_DISCOUNT_ADMIN_ONLY');
    const out = resolveDiscount(req, null, testActor(custom), TODAY);
    expect(out.isCustom).toBe(true);
    expect(out.rule).toEqual({
      kind: DiscountKind.FIXED,
      value: 500,
      maxAmount: null,
    });
  });

  it('maps a needs_approval decision to BILLING_DISCOUNT_NEEDS_APPROVAL', () => {
    ACCESS_POLICIES.set('billing.discount.apply', (_ctx, input) =>
      input.max !== undefined && (input.value ?? 0) > input.max
        ? 'needs_approval'
        : 'allow',
    );
    expect(
      codeOf(() =>
        resolveDiscount(
          { discountTypeId: 'type-1', value: 30 },
          senior(),
          testActor(preset),
          TODAY,
        ),
      ),
    ).toBe('BILLING_DISCOUNT_NEEDS_APPROVAL');
    expect(
      resolveDiscount(
        { discountTypeId: 'type-1', value: 12 },
        senior(),
        testActor(preset),
        TODAY,
      ).rule.value,
    ).toBe(12);
  });
});
