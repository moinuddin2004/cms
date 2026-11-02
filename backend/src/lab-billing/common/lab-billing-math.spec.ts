import { LabInvoiceStatus } from '../enums/lab-billing.enums';
import {
  bpOf,
  fifoAllocations,
  formatPkr,
  invoiceStatusFor,
  LineMathError,
  lineMath,
  spreadDiscount,
} from './lab-billing-math';

describe('lab billing math', () => {
  it('rounds tax half-up per line, in integer minor', () => {
    expect(bpOf(1_000, 1_500)).toBe(150);
    expect(bpOf(1, 5_000)).toBe(1); // 0.5 → 1
    expect(bpOf(3, 1_500)).toBe(0); // 0.45 → 0
    expect(bpOf(99_999_999_999, 10_000)).toBe(99_999_999_999); // no float drift
  });

  it('line: gross − discount + tax on the net', () => {
    expect(
      lineMath({
        quantity: 2,
        unitPriceMinor: 1_500_000,
        discountMinor: 200_000,
        taxRateBp: 0,
      }),
    ).toEqual({
      grossMinor: 3_000_000,
      netMinor: 2_800_000,
      taxMinor: 0,
      lineTotalMinor: 2_800_000,
    });
    expect(
      lineMath({
        quantity: 1,
        unitPriceMinor: 1_005,
        discountMinor: 0,
        taxRateBp: 1_700,
      }).taxMinor,
    ).toBe(171); // 170.85 → 171
  });

  it('refuses a discount above the line and fractional / negative minor', () => {
    expect(() =>
      lineMath({
        quantity: 1,
        unitPriceMinor: 100,
        discountMinor: 101,
        taxRateBp: 0,
      }),
    ).toThrow(LineMathError);
    expect(() =>
      lineMath({
        quantity: 1,
        unitPriceMinor: 10.5,
        discountMinor: 0,
        taxRateBp: 0,
      }),
    ).toThrow(LineMathError);
    expect(() =>
      lineMath({
        quantity: 0,
        unitPriceMinor: 100,
        discountMinor: 0,
        taxRateBp: 0,
      }),
    ).toThrow(LineMathError);
  });

  it('spreads an invoice discount by gross, largest remainder, summing exactly', () => {
    expect(spreadDiscount([1_500_000, 1_500_000], 200_000)).toEqual([
      100_000, 100_000,
    ]);
    const odd = spreadDiscount([100, 100, 100], 100);
    expect(odd.reduce((a, b) => a + b, 0)).toBe(100);
    expect(odd).toEqual([34, 33, 33]);
    expect(spreadDiscount([0, 500], 100)).toEqual([0, 100]);
    expect(() => spreadDiscount([100], 101)).toThrow(LineMathError);
  });

  it('status follows the balance; draft and void stay', () => {
    const s = (
      status: LabInvoiceStatus,
      paidMinor: number,
      balanceMinor: number,
    ) => invoiceStatusFor({ status, paidMinor, balanceMinor });
    expect(s(LabInvoiceStatus.ISSUED, 0, 100)).toBe(LabInvoiceStatus.ISSUED);
    expect(s(LabInvoiceStatus.ISSUED, 10, 90)).toBe(
      LabInvoiceStatus.PARTIALLY_PAID,
    );
    expect(s(LabInvoiceStatus.PARTIALLY_PAID, 100, 0)).toBe(
      LabInvoiceStatus.PAID,
    );
    expect(s(LabInvoiceStatus.PAID, 0, 100)).toBe(LabInvoiceStatus.ISSUED); // after a reversal
    expect(s(LabInvoiceStatus.DRAFT, 0, 100)).toBe(LabInvoiceStatus.DRAFT);
    expect(s(LabInvoiceStatus.VOID, 0, 0)).toBe(LabInvoiceStatus.VOID);
  });

  it('FIFO fills the oldest invoices first and keeps the rest as advance', () => {
    expect(
      fifoAllocations(
        [
          { id: 'a', balanceMinor: 300 },
          { id: 'b', balanceMinor: 0 },
          { id: 'c', balanceMinor: 500 },
        ],
        600,
      ),
    ).toEqual([
      { invoiceId: 'a', amountMinor: 300 },
      { invoiceId: 'c', amountMinor: 300 },
    ]);
    expect(fifoAllocations([{ id: 'a', balanceMinor: 300 }], 1_000)).toEqual([
      { invoiceId: 'a', amountMinor: 300 },
    ]);
  });

  it('formats rupees for messages', () => {
    expect(formatPkr(1_000_000)).toBe('PKR 10,000');
    expect(formatPkr(1_000_050)).toBe('PKR 10,000.50');
    expect(formatPkr(-500)).toBe('-PKR 5');
  });
});
