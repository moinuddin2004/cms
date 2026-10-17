import {
  DiscountKind,
  InvoicePaymentStatus,
  InvoiceRefundStatus,
  InvoiceStatus,
} from '../enums/billing.enums';
import {
  discountForCharge,
  discountsForCharges,
} from '../discounts/calculator/discount-calculator';
import { invoicePaymentStatus, invoiceRefundStatus } from './invoice-status';

const issued = { status: InvoiceStatus.ISSUED, dueDate: '2026-10-10' };

describe('invoicePaymentStatus', () => {
  it('derives status from amounts and the clinic date (D16)', () => {
    expect(
      invoicePaymentStatus(
        { ...issued, paidAmount: 0, balanceDue: 100 },
        '2026-10-10',
      ),
    ).toBe(InvoicePaymentStatus.UNPAID);
    expect(
      invoicePaymentStatus(
        { ...issued, paidAmount: 50, balanceDue: 50 },
        '2026-10-10',
      ),
    ).toBe(InvoicePaymentStatus.PARTIALLY_PAID);
    expect(
      invoicePaymentStatus(
        { ...issued, paidAmount: 0, balanceDue: 100 },
        '2026-10-11',
      ),
    ).toBe(InvoicePaymentStatus.OVERDUE);
    expect(
      invoicePaymentStatus(
        { ...issued, paidAmount: 100, balanceDue: 0 },
        '2026-12-01',
      ),
    ).toBe(InvoicePaymentStatus.PAID);
    expect(
      invoicePaymentStatus(
        {
          ...issued,
          status: InvoiceStatus.CANCELLED,
          paidAmount: 0,
          balanceDue: 100,
        },
        '2026-10-11',
      ),
    ).toBeNull();
  });
});

describe('invoiceRefundStatus (6.18 examples)', () => {
  it.each([
    [
      { paidAmount: 6000, releasedAmount: 0, refundedAmount: 0 },
      InvoiceRefundStatus.NONE,
    ],
    [
      { paidAmount: 3000, releasedAmount: 3000, refundedAmount: 3000 },
      InvoiceRefundStatus.PARTIALLY_REFUNDED,
    ],
    [
      { paidAmount: 0, releasedAmount: 6000, refundedAmount: 6000 },
      InvoiceRefundStatus.FULLY_REFUNDED,
    ],
    [
      { paidAmount: 0, releasedAmount: 6000, refundedAmount: 4000 },
      InvoiceRefundStatus.PARTIALLY_REFUNDED,
    ],
  ])('%o → %s', (inv, expected) => {
    expect(invoiceRefundStatus(inv)).toBe(expected);
  });
});

describe('discount calculator', () => {
  it('caps by maxAmount, then by gross', () => {
    expect(
      discountForCharge(300000, {
        kind: DiscountKind.PERCENTAGE,
        value: 10,
        maxAmount: 200,
      }),
    ).toBe(20000);
    expect(
      discountForCharge(10000, {
        kind: DiscountKind.FIXED,
        value: 500,
        maxAmount: null,
      }),
    ).toBe(10000);
  });

  it('bulk FIXED splits by gross and sums exactly (S11)', () => {
    const shares = discountsForCharges([120000, 300000, 180000], {
      kind: DiscountKind.FIXED,
      value: 500,
      maxAmount: null,
    });
    expect(shares).toEqual([10000, 25000, 15000]);
  });

  it('bulk PERCENTAGE re-splits the cap when exceeded (S11)', () => {
    const shares = discountsForCharges([120000, 300000, 180000], {
      kind: DiscountKind.PERCENTAGE,
      value: 10,
      maxAmount: 400,
    });
    expect(shares.reduce((a, b) => a + b, 0)).toBe(40000);
  });
});
