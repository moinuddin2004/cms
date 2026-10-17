import {
  AllocationMode,
  InvoicePaymentStatus,
} from 'src/billing/enums/billing.enums';
import { BillingFixture, createBillingFixture } from './billing-it.harness';
import {
  allocations,
  clinicDay,
  count,
  errorCode,
  ledger,
  ledgerBalance,
  uuid,
} from './helpers';

/** Plan 12.2: S1–S6, S13 — collecting payments. */
describe('Billing integration — collect', () => {
  let fx: BillingFixture;

  beforeAll(async () => {
    fx = await createBillingFixture();
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  /** Consultation 1,200 + Scaling 3,000 (day 1), Filling 1,800 (day 2). */
  async function threeCharges(patientId: string) {
    const day1 = clinicDay(fx, -2);
    const day2 = clinicDay(fx, -1);
    const consult = await fx.addCharge(fx.clinicA, patientId, {
      description: 'Consultation',
      unitPrice: 1200,
      chargeDate: day1,
    });
    const scaling = await fx.addCharge(fx.clinicA, patientId, {
      description: 'Scaling',
      unitPrice: 3000,
      chargeDate: day1,
    });
    const filling = await fx.addCharge(fx.clinicA, patientId, {
      description: 'Filling',
      unitPrice: 1800,
      chargeDate: day2,
    });
    return { consult, scaling, filling, all: [consult, scaling, filling] };
  }

  const sel = (...ids: string[]) => ids.map((chargeId) => ({ chargeId }));

  it('S1/S1b: FIFO collect issues one invoice, then the remainder settles it', async () => {
    const p = await fx.newPatient(fx.clinicA);
    const c = await threeCharges(p);

    const r = await fx.collect(fx.clinicA, p, {
      amount: 5800,
      selections: sel(...c.all.map((x) => x.id)),
    });

    expect(r.invoiceId).toBeTruthy();
    expect(r.allocations.map((a) => [a.chargeId, a.amount])).toEqual([
      [c.consult.id, 1200],
      [c.scaling.id, 3000],
      [c.filling.id, 1600],
    ]);
    const inv = await fx.invoices.detail(fx.clinicA.tenant, r.invoiceId!);
    expect(inv.totalAmount).toBe(6000);
    expect(inv.paidAmount).toBe(5800);
    expect(inv.balanceDue).toBe(200);
    expect(inv.paymentStatus).toBe(InvoicePaymentStatus.PARTIALLY_PAID);
    expect(inv.invoiceNumber).toMatch(/^KHI-INV-\d{4}-\d{5}$/);
    expect(r.payment?.receiptNumber).toMatch(/^KHI-REC-\d{4}-\d{5}$/);
    const filling = inv.charges!.find((x) => x.id === c.filling.id)!;
    expect(filling.balance).toBe(200);

    expect(
      (await ledger(fx, fx.clinicA, p)).map((l) => [l.type, l.debit, l.credit]),
    ).toEqual([
      ['INVOICE_ISSUED', 6000, 0],
      ['PAYMENT', 0, 5800],
    ]);
    expect(await ledgerBalance(fx, fx.clinicA, p)).toBe(200);
    expect(await fx.violations(fx.clinicA, p)).toEqual([]);

    // S1b: collect the last 200 selecting only Filling — no second invoice.
    const r2 = await fx.collect(fx.clinicA, p, {
      amount: 200,
      selections: sel(c.filling.id),
    });
    expect(r2.invoiceId).toBeNull();
    expect(await count(fx, 'invoices', p)).toBe(1);
    const paid = await fx.invoices.detail(fx.clinicA.tenant, r.invoiceId!);
    expect(paid.paymentStatus).toBe(InvoicePaymentStatus.PAID);
    expect(paid.balanceDue).toBe(0);
    expect(await ledgerBalance(fx, fx.clinicA, p)).toBe(0);
    expect(await fx.violations(fx.clinicA, p)).toEqual([]);
  });

  it('S2: overpayment becomes advance', async () => {
    const p = await fx.newPatient(fx.clinicA);
    const c = await threeCharges(p);
    const r = await fx.collect(fx.clinicA, p, {
      amount: 7000,
      selections: sel(...c.all.map((x) => x.id)),
    });
    const inv = await fx.invoices.detail(fx.clinicA.tenant, r.invoiceId!);
    expect(inv.paymentStatus).toBe(InvoicePaymentStatus.PAID);
    expect(r.payment?.advance).toBe(1000);
    expect(r.summary.advance).toBe(1000);
    expect(await ledgerBalance(fx, fx.clinicA, p)).toBe(-1000);
    expect(await fx.violations(fx.clinicA, p)).toEqual([]);
  });

  it('S3: deposit with no charges has a receipt and no invoice; advance later pays a new charge', async () => {
    const p = await fx.newPatient(fx.clinicA);
    const dep = await fx.collect(fx.clinicA, p, { amount: 5000 });
    expect(dep.payment?.receiptNumber).toBeTruthy();
    expect(dep.invoiceId).toBeNull();
    expect(await count(fx, 'invoices', p)).toBe(0);
    expect(dep.summary.advance).toBe(5000);

    const charge = await fx.addCharge(fx.clinicA, p, {
      description: 'Crown',
      unitPrice: 3000,
    });
    const applied = await fx.payments.applyAdvance(fx.ctx(fx.clinicA), p, {
      mode: AllocationMode.AUTO,
      selections: sel(charge.id),
    });
    expect(applied.payment).toBeNull();
    expect(applied.invoiceId).toBeTruthy();
    const inv = await fx.invoices.detail(fx.clinicA.tenant, applied.invoiceId!);
    expect(inv.paymentStatus).toBe(InvoicePaymentStatus.PAID);
    expect(applied.summary.advance).toBe(2000);
    // Applying advance posts nothing: only the deposit and the invoice are on the ledger.
    expect((await ledger(fx, fx.clinicA, p)).map((l) => l.type).sort()).toEqual(
      ['INVOICE_ISSUED', 'PAYMENT'],
    );
    expect(await count(fx, 'payments', p)).toBe(1);
    expect(await fx.violations(fx.clinicA, p)).toEqual([]);
  });

  it('S4: existing advance is applied first, the new payment covers the rest', async () => {
    const p = await fx.newPatient(fx.clinicA);
    const deposit = await fx.collect(fx.clinicA, p, { amount: 1000 });
    const charge = await fx.addCharge(fx.clinicA, p, {
      description: 'Root canal',
      unitPrice: 3000,
    });

    const r = await fx.collect(fx.clinicA, p, {
      amount: 2000,
      selections: sel(charge.id),
    });

    // Both rows share one transaction timestamp, so compare without order.
    const rows = (await allocations(fx, p)).sort((a, b) =>
      a.reason.localeCompare(b.reason),
    );
    expect(rows.map((a) => [a.reason, a.amount, a.paymentId])).toEqual([
      ['ADVANCE_APPLIED', 1000, deposit.payment!.id],
      ['PAYMENT', 2000, r.payment!.id],
    ]);
    expect(r.allocations.map((a) => [a.source, a.amount])).toEqual([
      ['ADVANCE', 1000],
      ['NEW', 2000],
    ]);
    expect(r.summary.advance).toBe(0);
    expect(await fx.violations(fx.clinicA, p)).toEqual([]);
  });

  it('S5: MANUAL mode rejects amounts over the balance or over the funds, writing nothing', async () => {
    const p = await fx.newPatient(fx.clinicA);
    const a = await fx.addCharge(fx.clinicA, p, {
      description: 'A',
      unitPrice: 1000,
    });
    const b = await fx.addCharge(fx.clinicA, p, {
      description: 'B',
      unitPrice: 1000,
    });

    expect(
      await errorCode(
        fx.collect(fx.clinicA, p, {
          amount: 1500,
          mode: AllocationMode.MANUAL,
          selections: [{ chargeId: a.id, amount: 1500 }],
        }),
      ),
    ).toBe('BILLING_ALLOCATION_EXCEEDS_BALANCE');

    expect(
      await errorCode(
        fx.collect(fx.clinicA, p, {
          amount: 1000,
          mode: AllocationMode.MANUAL,
          selections: [
            { chargeId: a.id, amount: 800 },
            { chargeId: b.id, amount: 800 },
          ],
        }),
      ),
    ).toBe('BILLING_ALLOCATION_EXCEEDS_FUNDS');

    expect(await count(fx, 'payments', p)).toBe(0);
    expect(await count(fx, 'invoices', p)).toBe(0);
    expect(await count(fx, 'payment_allocations', p)).toBe(0);
    expect(await ledger(fx, fx.clinicA, p)).toEqual([]);
    expect(await fx.violations(fx.clinicA, p)).toEqual([]);
  });

  it('S6: the same clientRequestId in parallel creates one payment and returns equal responses', async () => {
    const p = await fx.newPatient(fx.clinicA);
    const charge = await fx.addCharge(fx.clinicA, p, {
      description: 'Whitening',
      unitPrice: 2500,
    });
    const dto = fx.collectDto(fx.clinicA, p, {
      amount: 2500,
      selections: sel(charge.id),
    });

    const [a, b] = await Promise.all([
      fx.payments.collect(fx.ctx(fx.clinicA), dto),
      fx.payments.collect(fx.ctx(fx.clinicA), dto),
    ]);

    expect(await count(fx, 'payments', p)).toBe(1);
    expect(await count(fx, 'invoices', p)).toBe(1);
    expect(a.payment?.id).toBe(b.payment?.id);
    expect(a.payment?.receiptNumber).toBe(b.payment?.receiptNumber);
    expect(a.summary.advance).toBe(b.summary.advance);
    expect(await fx.violations(fx.clinicA, p)).toEqual([]);
  });

  it('S6b: a deposit retried with the same clientRequestId returns the first payment', async () => {
    const p = await fx.newPatient(fx.clinicA);
    const dto = fx.collectDto(fx.clinicA, p, { amount: 700 });
    const first = await fx.payments.collect(fx.ctx(fx.clinicA), dto);
    const second = await fx.payments.collect(fx.ctx(fx.clinicA), dto);
    expect(second.payment?.id).toBe(first.payment?.id);
    expect(await count(fx, 'payments', p)).toBe(1);
  });

  it('S13: two parallel MANUAL collects on one charge — one wins, the other is NOT_OPEN, no deadlock', async () => {
    const p = await fx.newPatient(fx.clinicA);
    const charge = await fx.addCharge(fx.clinicA, p, {
      description: 'Extraction',
      unitPrice: 1000,
    });
    const attempt = () =>
      fx.collect(fx.clinicA, p, {
        amount: 1000,
        mode: AllocationMode.MANUAL,
        selections: [{ chargeId: charge.id, amount: 1000 }],
        clientRequestId: uuid(),
      });

    const results = await Promise.allSettled([attempt(), attempt()]);

    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter(
      (r) => r.status === 'rejected',
    ) as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0].reason as { code?: string }).code).toBe(
      'BILLING_CHARGE_NOT_OPEN',
    );
    expect(await count(fx, 'payments', p)).toBe(1);
    expect(await fx.violations(fx.clinicA, p)).toEqual([]);
  });
});
