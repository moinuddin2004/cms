import { randomUUID } from 'crypto';
import {
  AllocationMode,
  DiscountKind,
  InvoicePaymentStatus,
  InvoiceRefundStatus,
  InvoiceStatus,
} from 'src/billing/enums/billing.enums';
import { BillingFixture, createBillingFixture } from './billing-it.harness';
import {
  allocations,
  clinicDay,
  count,
  errorCode,
  ledger,
  ledgerBalance,
} from './helpers';

/** Plan 12.2: S7–S12, S14, S17–S23 — invoice edits, cancel, unapply, discounts, refunds. */
describe('Billing integration — invoices, refunds, discounts', () => {
  let fx: BillingFixture;

  beforeAll(async () => {
    fx = await createBillingFixture();
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  const A = () => fx.clinicA;
  const tenant = () => fx.clinicA.tenant;

  async function threeCharges(patientId: string) {
    const make = (description: string, unitPrice: number, offset: number) =>
      fx.addCharge(A(), patientId, {
        description,
        unitPrice,
        chargeDate: clinicDay(fx, offset),
      });
    const consult = await make('Consultation', 1200, -2);
    const scaling = await make('Scaling', 3000, -2);
    const filling = await make('Filling', 1800, -1);
    return { consult, scaling, filling, all: [consult, scaling, filling] };
  }

  /** Three charges, one invoice of Rs 6,000, paid in full. */
  async function paidInvoice() {
    const p = await fx.newPatient(A());
    const c = await threeCharges(p);
    const r = await fx.collect(A(), p, {
      amount: 6000,
      selections: c.all.map((x) => ({ chargeId: x.id })),
    });
    return { p, c, invoiceId: r.invoiceId!, paymentId: r.payment!.id };
  }

  const voidOps = (...ids: string[]) =>
    ids.map((chargeId) => ({ op: 'voidCharge' as const, chargeId }));
  const edit = (
    revision: number,
    ops: ReturnType<typeof voidOps>,
    reason = 'Edited at the counter',
  ) => ({ expectedRevision: revision, operations: ops, reason });
  const refundBody = (amount: number, reason = 'Refund to patient') => ({
    amount,
    paymentAccountId: A().cashAccountId,
    reason,
    clientRequestId: randomUUID(),
  });
  const detail = (id: string) => fx.invoices.detail(tenant(), id);

  it('S7: voiding a paid charge releases its money to advance and adjusts the ledger', async () => {
    const { p, c, invoiceId, paymentId } = await paidInvoice();

    const dto = edit(1, voidOps(c.consult.id), 'Patient declined consultation');
    const after = await fx.invoices.edit(
      fx.ctx(A()),
      invoiceId,
      dto,
      dto.reason,
    );

    expect(after.revision).toBe(2);
    expect(after.totalAmount).toBe(4800);
    expect(after.paidAmount).toBe(4800);
    expect(after.paymentStatus).toBe(InvoicePaymentStatus.PAID);
    expect(after.releasedAmount).toBe(1200);
    const rows = await allocations(fx, p);
    expect(
      rows
        .filter((a) => a.reason === 'INVOICE_EDIT_RELEASE')
        .map((a) => [a.amount, a.paymentId]),
    ).toEqual([[-1200, paymentId]]);
    expect((await fx.patientBilling.summary(tenant(), p)).advance).toBe(1200);
    const led = await ledger(fx, A(), p);
    expect(led.map((l) => [l.type, l.debit, l.credit])).toEqual([
      ['INVOICE_ISSUED', 6000, 0],
      ['PAYMENT', 0, 6000],
      ['INVOICE_ADJUSTED', 0, 1200],
    ]);
    expect(led[2].description).toContain('2');

    const [audit] = await fx.dataSource.query(
      `SELECT before, after, reason FROM billing_audit_logs
        WHERE entity_id = $1 AND action = 'EDITED'`,
      [invoiceId],
    );
    expect(audit.before).toBeTruthy();
    expect(audit.after).toBeTruthy();
    expect(audit.reason).toBe('Patient declined consultation');
    expect(await fx.violations(A(), p)).toEqual([]);
  });

  it('S8: refund-from-invoice edits and refunds in one transaction', async () => {
    const { p, c, invoiceId } = await paidInvoice();

    const refund = await fx.refunds.createInvoiceRefund(
      fx.ctx(A()),
      invoiceId,
      {
        edit: edit(1, voidOps(c.consult.id), 'Consultation waived'),
        refund: refundBody(1200),
      },
    );

    expect(refund.invoiceId).toBe(invoiceId);
    const inv = await detail(invoiceId);
    expect(inv.revision).toBe(2);
    expect(inv.refundedAmount).toBe(1200);
    expect((await fx.patientBilling.summary(tenant(), p)).advance).toBe(0);
    expect(
      (await ledger(fx, A(), p)).map((l) => [l.type, l.debit, l.credit]),
    ).toEqual([
      ['INVOICE_ISSUED', 6000, 0],
      ['PAYMENT', 0, 6000],
      ['INVOICE_ADJUSTED', 0, 1200],
      ['REFUND', 1200, 0],
    ]);
    expect(await ledgerBalance(fx, A(), p)).toBe(0);
    expect(await fx.violations(A(), p)).toEqual([]);
  });

  it('S9: an unpaid invoice can be cancelled (charges unbilled again); a paid one cannot', async () => {
    const p = await fx.newPatient(A());
    const c = await threeCharges(p);
    const inv = await fx.invoices.create(fx.ctx(A()), {
      patientId: p,
      chargeIds: c.all.map((x) => x.id),
    });
    expect(inv.paymentStatus).toBe(InvoicePaymentStatus.UNPAID);

    const cancelled = await fx.invoices.cancel(
      fx.ctx(A()),
      inv.id,
      'Patient left without treatment',
    );
    expect(cancelled.status).toBe(InvoiceStatus.CANCELLED);
    expect(cancelled.invoiceNumber).toBe(inv.invoiceNumber);
    const rows: Array<{ invoice_id: string | null }> =
      await fx.dataSource.query(
        `SELECT invoice_id FROM charges WHERE patient_id = $1`,
        [p],
      );
    expect(rows.every((r) => r.invoice_id === null)).toBe(true);
    expect(
      (await ledger(fx, A(), p)).map((l) => [l.type, l.debit, l.credit]),
    ).toEqual([
      ['INVOICE_ISSUED', 6000, 0],
      ['INVOICE_CANCELLED', 0, 6000],
    ]);
    expect(await fx.violations(A(), p)).toEqual([]);

    const paid = await paidInvoice();
    expect(
      await errorCode(
        fx.invoices.cancel(
          fx.ctx(A()),
          paid.invoiceId,
          'Trying to cancel paid',
        ),
      ),
    ).toBe('BILLING_INVOICE_HAS_PAYMENTS');
    expect((await detail(paid.invoiceId)).status).toBe(InvoiceStatus.ISSUED);
    expect(await fx.violations(A(), paid.p)).toEqual([]);
  });

  it('S10: unapplying a payment sends its money back to advance without a ledger entry', async () => {
    const p = await fx.newPatient(A());
    const c = await threeCharges(p);
    const r = await fx.collect(A(), p, {
      amount: 5800,
      selections: c.all.map((x) => ({ chargeId: x.id })),
    });
    const ledgerBefore = (await ledger(fx, A(), p)).length;

    const payment = await fx.payments.unapply(fx.ctx(A()), r.payment!.id, {
      reason: 'Applied to wrong charges',
    });

    expect(payment.advance).toBe(5800);
    expect(payment.allocatedAmount).toBe(0);
    const inv = await detail(r.invoiceId!);
    expect(inv.paidAmount).toBe(0);
    expect(inv.paymentStatus).toBe(InvoicePaymentStatus.UNPAID);
    expect((await ledger(fx, A(), p)).length).toBe(ledgerBefore);
    expect(await fx.violations(A(), p)).toEqual([]);

    // Re-apply the released money (D13): a new allocation, nothing updated in place.
    const again = await fx.payments.applyAdvance(fx.ctx(A()), p, {
      mode: AllocationMode.AUTO,
      selections: c.all.map((x) => ({ chargeId: x.id })),
    });
    expect(again.summary.advance).toBe(0);
    expect((await detail(r.invoiceId!)).paidAmount).toBe(5800);
    expect(await fx.violations(A(), p)).toEqual([]);
  });

  it('S11: bulk discounts split exactly across charges', async () => {
    const p = await fx.newPatient(A());
    const c = await threeCharges(p);
    const ids = c.all.map((x) => x.id);

    const fixed = await fx.charges.bulkDiscount(fx.ctx(A(), 'admin'), {
      chargeIds: ids,
      kind: DiscountKind.FIXED,
      value: 500,
      note: 'Loyalty',
    });
    const byId = new Map(fixed.charges.map((x) => [x.id, x.discount?.amount]));
    expect(
      [c.consult.id, c.scaling.id, c.filling.id].map((id) => byId.get(id)),
    ).toEqual([100, 250, 150]);
    expect([...byId.values()].reduce<number>((a, v) => a + (v ?? 0), 0)).toBe(500);

    const type = await fx.discountTypes.create(fx.ctx(A(), 'admin'), {
      name: `Ten percent ${randomUUID().slice(0, 6)}`,
      kind: DiscountKind.PERCENTAGE,
      value: 10,
      maxAmount: 400,
    });
    const pct = await fx.charges.bulkDiscount(fx.ctx(A()), {
      chargeIds: ids,
      discountTypeId: type.id,
    });
    const amounts = new Map(pct.charges.map((x) => [x.id, x.discount?.amount]));
    expect(
      [c.consult.id, c.scaling.id, c.filling.id].map((id) => amounts.get(id)),
    ).toEqual([80, 200, 120]);
    expect([...amounts.values()].reduce<number>((a, v) => a + (v ?? 0), 0)).toBe(400);
    expect(await fx.violations(A(), p)).toEqual([]);
  });

  it('S12: with dueDays = 0 an unpaid invoice is overdue the next clinic day, then PAID', async () => {
    const adminCtx = fx.ctx(A(), 'admin');
    await fx.settings.update(adminCtx, { dueDays: 0 });
    try {
      const p = await fx.newPatient(A());
      fx.setNow(`${clinicDay(fx, -1)}T05:00:00Z`); // yesterday 10:00 PKT
      const charge = await fx.addCharge(A(), p, {
        description: 'Retainer',
        unitPrice: 900,
      });
      const inv = await fx.invoices.create(fx.ctx(A()), {
        patientId: p,
        chargeIds: [charge.id],
      });
      expect(inv.dueDate).toBe(inv.issueDate);
      expect(inv.paymentStatus).toBe(InvoicePaymentStatus.UNPAID);

      fx.resetNow();
      expect((await detail(inv.id)).paymentStatus).toBe(
        InvoicePaymentStatus.OVERDUE,
      );

      await fx.collect(A(), p, {
        amount: 900,
        selections: [{ chargeId: charge.id }],
      });
      expect((await detail(inv.id)).paymentStatus).toBe(
        InvoicePaymentStatus.PAID,
      );
      expect(await fx.violations(A(), p)).toEqual([]);
    } finally {
      fx.resetNow();
      await fx.settings.update(adminCtx, { dueDays: 7 });
    }
  });

  it('S14: numbering follows the clinic year (31 Dec 23:30 PKT vs 1 Jan 00:10 PKT)', async () => {
    const p = await fx.newPatient(A());
    try {
      fx.setNow('2027-12-31T18:30:00Z'); // 23:30 PKT
      const a = await fx.addCharge(A(), p, {
        description: 'Late visit',
        unitPrice: 500,
      });
      const first = await fx.invoices.create(fx.ctx(A()), {
        patientId: p,
        chargeIds: [a.id],
      });

      fx.setNow('2027-12-31T19:10:00Z'); // 00:10 PKT, 1 Jan 2028
      const b = await fx.addCharge(A(), p, {
        description: 'New year visit',
        unitPrice: 500,
      });
      const second = await fx.invoices.create(fx.ctx(A()), {
        patientId: p,
        chargeIds: [b.id],
      });
      const receipt = await fx.collect(A(), p, {
        amount: 500,
        selections: [{ chargeId: b.id }],
      });

      expect(first.invoiceNumber).toMatch(/^KHI-INV-2027-\d{5}$/);
      expect(second.invoiceNumber).toBe('KHI-INV-2028-00001');
      expect(receipt.payment?.receiptNumber).toBe('KHI-REC-2028-00001');
      expect(await fx.violations(A(), p)).toEqual([]);
    } finally {
      fx.resetNow();
    }
  });

  it('S17: a stale expectedRevision is a 409 and writes nothing', async () => {
    const { p, c, invoiceId } = await paidInvoice();
    const ledgerBefore = (await ledger(fx, A(), p)).length;
    const dto = edit(5, voidOps(c.consult.id));
    expect(
      await errorCode(
        fx.invoices.edit(fx.ctx(A()), invoiceId, dto, dto.reason),
      ),
    ).toBe('BILLING_INVOICE_REVISION_CONFLICT');
    expect((await detail(invoiceId)).revision).toBe(1);
    expect((await ledger(fx, A(), p)).length).toBe(ledgerBefore);
    expect(await fx.violations(A(), p)).toEqual([]);
  });

  it('S18: refunding more than the advance is rejected', async () => {
    const p = await fx.newPatient(A());
    await fx.collect(A(), p, { amount: 1000 });
    expect(
      await errorCode(
        fx.refunds.createAdvanceRefund(fx.ctx(A()), {
          patientId: p,
          ...refundBody(1500),
        }),
      ),
    ).toBe('BILLING_REFUND_EXCEEDS_ADVANCE');
    expect(await count(fx, 'refunds', p)).toBe(0);
    expect(await fx.violations(A(), p)).toEqual([]);
  });

  it('S19: refund-from-invoice after voiding Scaling is partially refunded and names the invoice', async () => {
    const { p, c, invoiceId } = await paidInvoice();
    const refund = await fx.refunds.createInvoiceRefund(
      fx.ctx(A()),
      invoiceId,
      {
        edit: edit(1, voidOps(c.scaling.id), 'Scaling not done'),
        refund: refundBody(3000),
      },
    );
    const inv = await detail(invoiceId);
    expect(refund.invoiceId).toBe(invoiceId);
    expect(inv.totalAmount).toBe(3000);
    expect(inv.refundedAmount).toBe(3000);
    expect(inv.refundStatus).toBe(InvoiceRefundStatus.PARTIALLY_REFUNDED);
    expect(inv.paymentStatus).toBe(InvoicePaymentStatus.PAID);
    const led = await ledger(fx, A(), p);
    expect(led[led.length - 1].description).toContain(inv.invoiceNumber);
    expect(led[led.length - 1].description).toContain(refund.refundNumber);
    expect(await fx.violations(A(), p)).toEqual([]);
  });

  it('S20: voiding everything and refunding it all is FULLY_REFUNDED', async () => {
    const { p, c, invoiceId } = await paidInvoice();
    await fx.refunds.createInvoiceRefund(fx.ctx(A()), invoiceId, {
      edit: edit(1, voidOps(...c.all.map((x) => x.id)), 'Treatment cancelled'),
      refund: refundBody(6000),
    });
    const inv = await detail(invoiceId);
    expect(inv.totalAmount).toBe(0);
    expect(inv.paidAmount).toBe(0);
    expect(inv.refundStatus).toBe(InvoiceRefundStatus.FULLY_REFUNDED);
    expect(await ledgerBalance(fx, A(), p)).toBe(0);
    expect(await fx.violations(A(), p)).toEqual([]);
  });

  it('S21: a partial refund can be completed later from the invoice without an edit', async () => {
    const { p, c, invoiceId } = await paidInvoice();
    await fx.refunds.createInvoiceRefund(fx.ctx(A()), invoiceId, {
      edit: edit(1, voidOps(...c.all.map((x) => x.id)), 'Treatment cancelled'),
      refund: refundBody(4000),
    });
    const partial = await detail(invoiceId);
    expect(partial.refundStatus).toBe(InvoiceRefundStatus.PARTIALLY_REFUNDED);
    expect(partial.refundableAmount).toBe(2000);

    await fx.refunds.createInvoiceRefund(fx.ctx(A()), invoiceId, {
      refund: refundBody(2000),
    });
    const done = await detail(invoiceId);
    expect(done.refundStatus).toBe(InvoiceRefundStatus.FULLY_REFUNDED);
    expect(done.refundableAmount).toBe(0);
    expect(done.refunds).toHaveLength(2);
    expect(await fx.violations(A(), p)).toEqual([]);
  });

  it('S22: an invoice refund above the refundable amount is rejected and the edit rolls back', async () => {
    const { p, c, invoiceId } = await paidInvoice();
    await fx.collect(A(), p, { amount: 5000 }); // extra advance, so only the invoice rule can fail
    const refundsBefore = await count(fx, 'refunds', p);

    expect(
      await errorCode(
        fx.refunds.createInvoiceRefund(fx.ctx(A()), invoiceId, {
          edit: edit(1, voidOps(c.consult.id), 'Consultation waived'),
          refund: refundBody(1500),
        }),
      ),
    ).toBe('BILLING_REFUND_EXCEEDS_INVOICE_REFUNDABLE');

    const inv = await detail(invoiceId);
    expect(inv.revision).toBe(1);
    expect(inv.totalAmount).toBe(6000);
    expect(await count(fx, 'refunds', p)).toBe(refundsBefore);
    expect(await fx.violations(A(), p)).toEqual([]);
  });

  it('S23: an advance refund never counts against an invoice', async () => {
    const { p, invoiceId } = await paidInvoice();
    await fx.collect(A(), p, { amount: 800 });
    const refund = await fx.refunds.createAdvanceRefund(fx.ctx(A()), {
      patientId: p,
      ...refundBody(800),
    });
    expect(refund.invoiceId).toBeNull();
    const inv = await detail(invoiceId);
    expect(inv.refundedAmount).toBe(0);
    expect(inv.refundStatus).toBe(InvoiceRefundStatus.NONE);
    expect(await fx.violations(A(), p)).toEqual([]);
  });
});
