import { HttpException } from '@nestjs/common';
import { testActor } from '../common/billing-access.testing';
import { assertCanSetPrice } from './price-policy';

const catalogCharge = { serviceId: 'svc-1', needsPricing: false };

describe('assertCanSetPrice — billing.price.override', () => {
  it('refuses a catalog price change without billing.price.override', () => {
    const desk = testActor({ 'billing.desk.use': true });
    let err: HttpException | undefined;
    try {
      assertCanSetPrice(desk, catalogCharge);
    } catch (e) {
      err = e as HttpException;
    }
    expect(err?.getStatus()).toBe(403);
    expect(err?.getResponse()).toMatchObject({
      code: 'BILLING_PRICE_CHANGE_NOT_ALLOWED',
    });
  });

  it('allows it with billing.price.override', () => {
    expect(() =>
      assertCanSetPrice(
        testActor({ 'billing.price.override': true }),
        catalogCharge,
      ),
    ).not.toThrow();
  });

  it('anyone may price "Other" charges or ones still needing a price', () => {
    const none = testActor();
    expect(() =>
      assertCanSetPrice(none, { serviceId: null, needsPricing: false }),
    ).not.toThrow();
    expect(() =>
      assertCanSetPrice(none, { serviceId: 'svc-1', needsPricing: true }),
    ).not.toThrow();
  });
});
