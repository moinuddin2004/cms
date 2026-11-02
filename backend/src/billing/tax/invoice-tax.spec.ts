import { sumMinor, toMinor } from '../common/money';
import { chargeBalanceMinor } from '../charges/charge-math';
import { ChargeStatus } from '../enums/billing.enums';
import {
  applyInvoiceTax,
  chargePayableMinor,
  invoiceTaxMinor,
  preTaxMinor,
  splitInvoiceTax,
  taxOnMinor,
  TaxableCharge,
} from './invoice-tax';

interface TestCharge extends TaxableCharge {
  status: ChargeStatus;
  allocatedAmount: number;
}

const charge = (
  netAmount: number,
  status: ChargeStatus = ChargeStatus.ACTIVE,
): TestCharge => ({
  status,
  netAmount,
  taxAmount: 0,
  allocatedAmount: 0,
});

describe('invoice sales tax (exclusive)', () => {
  it('tax = round(taxable × rate / 100), taxable = subtotal after discounts', () => {
    // Rs 1,500 gross − Rs 300 discount = Rs 1,200 taxable at 17% → Rs 204.
    expect(taxOnMinor(120_000, 17)).toBe(20_400);
    expect(invoiceTaxMinor([charge(1200)], 17)).toBe(20_400);
    // total = subtotal − discount + tax
    expect(150_000 - 30_000 + invoiceTaxMinor([charge(1200)], 17)).toBe(
      140_400,
    );
  });

  it('rounds half-up once, on the invoice — not per line', () => {
    // 3 × Rs 0.10 at 5%: per line 0.5 minor units each; on the invoice 1.5 → 2.
    const lines = [charge(0.1), charge(0.1), charge(0.1)];
    expect(invoiceTaxMinor(lines, 5)).toBe(2);
    expect(sumMinor(splitInvoiceTax(lines, 5))).toBe(2);
  });

  it('handles fractional rates exactly', () => {
    expect(taxOnMinor(100_001, 16.15)).toBe(16_150);
    expect(taxOnMinor(100_000, '17.5')).toBe(17_500);
  });

  it('rate 0 / null / negative = no tax', () => {
    expect(invoiceTaxMinor([charge(1000)], 0)).toBe(0);
    expect(invoiceTaxMinor([charge(1000)], null)).toBe(0);
    expect(invoiceTaxMinor([charge(1000)], undefined)).toBe(0);
    expect(invoiceTaxMinor([charge(1000)], -3)).toBe(0);
    const lines = [charge(1000), charge(500)];
    expect(applyInvoiceTax(lines, 0)).toBe(0);
    expect(lines.map((c) => c.taxAmount)).toEqual([0, 0]);
  });

  it('VOID charges are not taxed and get a 0 share', () => {
    const lines = [charge(1000), charge(500, ChargeStatus.VOID)];
    expect(invoiceTaxMinor(lines, 10)).toBe(10_000);
    expect(applyInvoiceTax(lines, 10)).toBe(10_000);
    expect(lines.map((c) => c.taxAmount)).toEqual([100, 0]);
  });

  it('spreads the invoice tax over charges so shares sum exactly to it', () => {
    const lines = [charge(333.33), charge(333.33), charge(333.34)];
    const total = applyInvoiceTax(lines, 17);
    expect(total).toBe(invoiceTaxMinor(lines, 17));
    expect(sumMinor(lines.map((c) => toMinor(c.taxAmount)))).toBe(total);
  });

  it('a charge keeps its share when another line changes', () => {
    const a = charge(1000);
    const b = charge(250);
    applyInvoiceTax([a, b], 17);
    expect(a.taxAmount).toBe(170);
    b.netAmount = 999.99;
    applyInvoiceTax([a, b], 17);
    expect(a.taxAmount).toBe(170);
    expect(b.taxAmount).toBe(170);
  });

  it('the rounding difference lands on the largest charge', () => {
    // Per line at 50%: 0.5 → 1, 1.5 → 2, 0.5 → 1 (sum 4) but the invoice
    // tax is round(5 × 0.5) = 3 minor units: the largest line gives one back.
    const lines = [charge(0.01), charge(0.03), charge(0.01)];
    const shares = splitInvoiceTax(lines, 50);
    expect(invoiceTaxMinor(lines, 50)).toBe(3);
    expect(shares).toEqual([1, 1, 1]);
  });

  it('payable / balance = net + tax − allocated (VOID → 0)', () => {
    const c = { ...charge(1000), taxAmount: 170, allocatedAmount: 500 };
    expect(chargePayableMinor(c)).toBe(117_000);
    expect(chargeBalanceMinor(c)).toBe(67_000);
    expect(chargePayableMinor({ ...c, status: ChargeStatus.VOID })).toBe(0);
    expect(chargeBalanceMinor({ ...c, status: ChargeStatus.VOID })).toBe(0);
  });

  describe('preTaxMinor (commission / revenue base)', () => {
    it('fully paid → exactly net', () => {
      expect(preTaxMinor(117_000, 100_000, 17_000)).toBe(100_000);
    });
    it('part paid → pro rata, half-up', () => {
      expect(preTaxMinor(58_500, 100_000, 17_000)).toBe(50_000);
      expect(preTaxMinor(1, 100_000, 17_000)).toBe(1);
    });
    it('no tax → collected, capped at net', () => {
      expect(preTaxMinor(40_000, 100_000, 0)).toBe(40_000);
      expect(preTaxMinor(140_000, 100_000, 0)).toBe(100_000);
    });
    it('nothing collected or net 0 → 0', () => {
      expect(preTaxMinor(0, 100_000, 17_000)).toBe(0);
      expect(preTaxMinor(-5, 100_000, 17_000)).toBe(0);
      expect(preTaxMinor(5_000, 0, 0)).toBe(0);
    });
  });
});
