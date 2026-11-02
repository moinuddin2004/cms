/* Supertest bodies are untyped JSON; these suites assert on their shape. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import type { Response } from 'supertest';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { ServiceKind } from 'src/billing/enums/billing.enums';
import { localDate } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import { LabBillingModule } from 'src/lab-billing/lab-billing.module';
import { LabBillingEvents } from 'src/lab-billing/events/lab-billing-events';
import { ServiceCategory } from 'src/lab-catalog/entities/service-category.entity';
import { LabCatalogModule } from 'src/lab-catalog/lab-catalog.module';
import { LabOrdersModule } from 'src/lab-orders/lab-orders.module';
import { OrderLifecycleHooks } from 'src/lab-orders/workflow/order-hooks';
import { Patient } from 'src/patients/entities/patient.entity';
import { Clinic, LabsFixture, createLabsFixture } from './labs-it.harness';

const code = (res: Response): string | undefined =>
  (res.body?.error?.code ?? res.body?.code) as string | undefined;

const ok = (res: Response, status = 200) => {
  if (res.status !== status)
    throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
};

/**
 * Sprint 9 — patient billing for lab work (lab ERD §6a, §10 "Patient
 * payment" / "Payment reversal", inv. 4, 5, 10, §15 Ali example, §16 + §19
 * patient notifications OFF → skipped_disabled).
 */
describe('Lab billing (API)', () => {
  let fx: LabsFixture;
  let A: Clinic;
  let lab: { id: string };
  let crown: { id: string };
  let ali: string;
  let sana: string;
  const today = localDate('Asia/Karachi', new Date());
  const collected: Array<{ event: string; payload: any }> = [];

  /** Clinic A admin; `key` → Idempotency-Key header. */
  const call = (
    method: 'get' | 'post' | 'patch' | 'put',
    url: string,
    body?: object,
    opts: { key?: string; as?: string; clinic?: Clinic } = {},
  ) => {
    const clinic = opts.clinic ?? A;
    let r = request(fx.app.getHttpServer())
      [method](url)
      .set('x-test-user', opts.as ?? clinic.admin)
      .set('x-organization-id', clinic.organizationId)
      .set('x-location-id', clinic.locationId);
    if (opts.key) r = r.set('idempotency-key', opts.key);
    return r.send(body);
  };

  /** A submitted order with one crown per tooth (PKR 5,000 lab / 15,000 patient). */
  const submittedOrder = async (patientId: string, crowns: number) => {
    const d = await fx.clinic('post', '/lab-orders', A, A.doctor, {
      patientId,
      labId: lab.id,
      items: Array.from({ length: crowns }, () => ({ labServiceId: crown.id })),
    });
    expect(d.status).toBe(201);
    const s = await request(fx.app.getHttpServer())
      .post(`/lab-orders/${d.body.data.id}/submit`)
      .set('x-test-user', A.doctor)
      .set('x-organization-id', A.organizationId)
      .set('x-location-id', A.locationId)
      .set('idempotency-key', randomUUID())
      .send({ version: d.body.data.version });
    expect(s.status).toBe(201);
    return s.body.data as { id: string; items: { id: string }[] };
  };

  const invoice = async (id: string) =>
    ok(await call('get', `/lab-billing/invoices/${id}`));
  const summary = async (patientId: string) =>
    ok(await call('get', `/lab-billing/patients/${patientId}/summary`));
  const pay = async (body: object, key: string = randomUUID()) =>
    ok(await call('post', '/lab-billing/payments', body, { key }), 201);

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_billing_api', [
      LabCatalogModule,
      LabOrdersModule,
      LabBillingModule,
    ]);
    A = fx.clinicA;
    const m = fx.dataSource.manager;
    const events = fx.app.get(LabBillingEvents);
    for (const e of [
      'paymentCollected',
      'paymentReversed',
      'creditNoteIssued',
    ] as const)
      events.on(e, (_m, payload) => {
        collected.push({ event: e, payload });
        return Promise.resolve();
      });

    const category = await m
      .getRepository(ServiceCategory)
      .findOneByOrFail({ code: 'CROWN' });
    lab = ok(
      await fx.platform('post', '/platform/labs', fx.superAdmin, {
        name: `Billing IT Lab ${randomUUID().slice(0, 6)}`,
        labType: 'external',
        city: 'Lahore',
      }),
      201,
    );
    crown = ok(
      await fx.platform(
        'post',
        `/platform/labs/${lab.id}/services`,
        fx.superAdmin,
        {
          categoryId: category.id,
          code: 'zirconia_crown',
          name: 'Zirconia crown',
          unitType: 'per_case',
          defaultTurnaroundDays: 5,
        },
      ),
      201,
    );
    ok(
      await fx.platform(
        'post',
        `/platform/labs/${lab.id}/services/${crown.id}/prices`,
        fx.superAdmin,
        {
          unitPriceMinor: 500_000,
          effectiveFrom: today,
        },
      ),
      201,
    );
    const link = ok(
      await fx.clinic('post', '/lab-links', A, A.admin, { labId: lab.id }),
      201,
    );
    ok(
      await fx.clinic('post', `/lab-links/${link.id}/transitions`, A, A.admin, {
        action: 'activate',
        version: 1,
      }),
      201,
    );
    const treatment = await m.getRepository(CatalogService).save({
      organizationId: A.organizationId,
      name: 'Zirconia crown',
      kind: ServiceKind.PROCEDURE,
      defaultPrice: 15_000,
    });
    ok(
      await fx.clinic('post', '/lab-catalog/mappings', A, A.admin, {
        clinicTreatmentId: treatment.id,
        labServiceId: crown.id,
      }),
      201,
    );
    const patients = m.getRepository(Patient);
    ali = (
      await patients.save({
        organizationId: A.organizationId,
        patientNumber: `P-${randomUUID().slice(0, 6)}`,
        fullName: 'Ali Ahmed',
        phone: '03001234567',
      } as Partial<Patient>)
    ).id;
    sana = (
      await patients.save({
        organizationId: A.organizationId,
        patientNumber: `P-${randomUUID().slice(0, 6)}`,
        fullName: 'Sana Iqbal',
        phone: '03001234568',
      } as Partial<Patient>)
    ).id;
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  describe('§15 worked example: Ali Ahmed, two zirconia crowns', () => {
    let orderId: string;
    let invoiceId: string;
    let advanceKey: string;
    let advancePaymentId: string;
    let finalPaymentId: string;

    beforeAll(async () => {
      orderId = (await submittedOrder(ali, 2)).id;
    });

    it('the order panel offers both crowns at the frozen patient price', async () => {
      const panel = ok(await call('get', `/lab-billing/orders/${orderId}`));
      expect(panel.invoices).toEqual([]);
      expect(
        panel.unbilledItems.map((i: any) => i.patientLinePriceMinor),
      ).toEqual([1_500_000, 1_500_000]);
    });

    it('an estimate is a draft: no number and nothing owed', async () => {
      const est = ok(
        await call('post', '/lab-billing/invoices', {
          orderId,
          discountMinor: 200_000,
        }),
        201,
      );
      invoiceId = est.id;
      expect(est).toMatchObject({
        status: 'draft',
        invoiceNo: null,
        subtotalMinor: 3_000_000,
        discountMinor: 200_000,
        taxMinor: 0,
        totalMinor: 2_800_000,
      });
      expect(est.lines.map((l: any) => l.discountMinor)).toEqual([
        100_000, 100_000,
      ]);
      expect((await summary(ali)).receivableMinor).toBe(0);
    });

    it('step 1 — issue: 30,000 − 2,000 → invoice 28,000, receivable 28,000', async () => {
      const draft = await invoice(invoiceId);
      const inv = ok(
        await call('post', `/lab-billing/invoices/${invoiceId}/issue`, {
          version: draft.version,
        }),
      );
      expect(inv.invoiceNo).toMatch(/^LINV-\d{4}$/);
      expect(inv).toMatchObject({
        status: 'issued',
        totalMinor: 2_800_000,
        paidMinor: 0,
        balanceMinor: 2_800_000,
        issuedOn: today,
      });
      expect(await summary(ali)).toMatchObject({
        invoicedMinor: 2_800_000,
        receivableMinor: 2_800_000,
        advanceMinor: 0,
      });
    });

    it('step 2 — advance 10,000: payment + allocation → receivable 18,000, partially_paid', async () => {
      advanceKey = randomUUID();
      const p = await pay(
        {
          patientId: ali,
          amountMinor: 1_000_000,
          method: 'cash',
          allocations: [{ invoiceId, amountMinor: 1_000_000 }],
        },
        advanceKey,
      );
      advancePaymentId = p.id;
      expect(p.receiptNo).toMatch(/^LRC-\d{4}$/);
      expect(p.allocations).toHaveLength(1);
      const inv = await invoice(invoiceId);
      expect(inv).toMatchObject({
        status: 'partially_paid',
        paidMinor: 1_000_000,
        balanceMinor: 1_800_000,
      });
      expect(await summary(ali)).toMatchObject({
        invoicedMinor: 2_800_000,
        collectedMinor: 1_000_000,
        receivableMinor: 1_800_000,
      });
      // The hook Sprint 10's ledger + commission use.
      expect(collected.at(-1)).toMatchObject({
        event: 'paymentCollected',
        payload: {
          paymentId: p.id,
          amountMinor: 1_000_000,
          allocations: [{ invoiceId, amountMinor: 1_000_000 }],
        },
      });
    });

    it('inv. 10: the same Idempotency-Key gives the same payment, never a second one', async () => {
      const again = await pay(
        {
          patientId: ali,
          amountMinor: 1_000_000,
          method: 'cash',
          allocations: [{ invoiceId, amountMinor: 1_000_000 }],
        },
        advanceKey,
      );
      expect(again.id).toBe(advancePaymentId);
      const [{ n }] = await sqlRows<{ n: string }>(
        fx.dataSource,
        `SELECT count(*) AS n FROM lab_payments WHERE patient_id = $1`,
        [ali],
      );
      expect(Number(n)).toBe(1);
      expect((await invoice(invoiceId)).balanceMinor).toBe(1_800_000);

      const reused = await call(
        'post',
        '/lab-billing/payments',
        { patientId: ali, amountMinor: 5_000, method: 'cash' },
        { key: advanceKey },
      );
      expect(reused.status).toBe(422);
      expect(code(reused)).toBe('IDEMPOTENCY_KEY_REUSED');

      const noKey = await call('post', '/lab-billing/payments', {
        patientId: ali,
        amountMinor: 5_000,
        method: 'cash',
      });
      expect(noKey.status).toBe(400);
      expect(code(noKey)).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('steps 3–6 are lab-side (Sprint 10) and leave the receivable alone', async () => {
      expect((await summary(ali)).receivableMinor).toBe(1_800_000);
    });

    it('step 7 — Ali pays 18,000 (oldest invoice first) → receivable 0, invoice paid', async () => {
      const p = await pay({
        patientId: ali,
        amountMinor: 1_800_000,
        method: 'card',
        reference: 'POS-1',
      });
      finalPaymentId = p.id;
      expect(p.allocations).toEqual([
        expect.objectContaining({
          invoiceId,
          amountMinor: 1_800_000,
          reversedAt: null,
        }),
      ]);
      expect(await invoice(invoiceId)).toMatchObject({
        status: 'paid',
        paidMinor: 2_800_000,
        balanceMinor: 0,
      });
      expect(await summary(ali)).toMatchObject({
        invoicedMinor: 2_800_000,
        collectedMinor: 2_800_000,
        receivableMinor: 0,
        advanceMinor: 0,
      });
    });

    it('§19: payment reversal puts the balance back; allocations get reversed_at', async () => {
      const key = randomUUID();
      const rev = ok(
        await call(
          'post',
          `/lab-billing/payments/${finalPaymentId}/reverse`,
          { reason: 'Card charge declined by bank' },
          { key },
        ),
      );
      expect(rev).toMatchObject({
        isReversal: true,
        amountMinor: -1_800_000,
        reversalOf: { id: finalPaymentId },
      });
      expect(rev.receiptNo).toMatch(/^LRV-\d{4}$/);
      const original = ok(
        await call('get', `/lab-billing/payments/${finalPaymentId}`),
      );
      expect(original).toMatchObject({
        status: 'reversed',
        allocatedMinor: 0,
        reversedBy: { id: rev.id },
      });
      expect(original.allocations[0].reversedAt).not.toBeNull();
      expect(original.allocations[0].releaseReason).toBe('payment_reversed');
      expect(await invoice(invoiceId)).toMatchObject({
        status: 'partially_paid',
        paidMinor: 1_000_000,
        balanceMinor: 1_800_000,
      });
      expect((await summary(ali)).receivableMinor).toBe(1_800_000);
      expect(collected.at(-1)).toMatchObject({
        event: 'paymentReversed',
        payload: {
          paymentId: finalPaymentId,
          reversalPaymentId: rev.id,
          amountMinor: 1_800_000,
        },
      });

      // Same key → the same reversal; a new key → already reversed.
      const replay = ok(
        await call(
          'post',
          `/lab-billing/payments/${finalPaymentId}/reverse`,
          { reason: 'again' },
          { key },
        ),
      );
      expect(replay.id).toBe(rev.id);
      const twice = await call(
        'post',
        `/lab-billing/payments/${finalPaymentId}/reverse`,
        { reason: 'again' },
        { key: randomUUID() },
      );
      expect(twice.status).toBe(409);
      expect(code(twice)).toBe('LAB_BILLING_PAYMENT_REVERSED');

      // The correct entry after the reversal settles it again.
      await pay({ patientId: ali, amountMinor: 1_800_000, method: 'cash' });
      expect(await invoice(invoiceId)).toMatchObject({
        status: 'paid',
        balanceMinor: 0,
      });
      expect((await summary(ali)).receivableMinor).toBe(0);
    });

    it('an item already on an invoice is never billed twice', async () => {
      const again = await call('post', '/lab-billing/invoices', { orderId });
      expect(again.status).toBe(422); // nothing left to bill
      const panel = ok(await call('get', `/lab-billing/orders/${orderId}`));
      expect(panel.unbilledItems).toEqual([]);
      expect(panel.totals).toMatchObject({
        billedMinor: 2_800_000,
        paidMinor: 2_800_000,
        balanceMinor: 0,
      });
    });
  });

  describe('invariants', () => {
    let invoiceId: string;

    beforeAll(async () => {
      const order = await submittedOrder(sana, 1);
      invoiceId = ok(
        await call('post', '/lab-billing/invoices', {
          orderId: order.id,
          issue: true,
          taxRateBp: 1_700,
        }),
        201,
      ).id;
    });

    it('tax in basis points, half-up per line', async () => {
      // 15,000 × 17% = 2,550 → total 17,550.
      expect(await invoice(invoiceId)).toMatchObject({
        taxMinor: 255_000,
        totalMinor: 1_755_000,
        balanceMinor: 1_755_000,
      });
    });

    it('inv. 5: allocations may not exceed the payment, nor an invoice its balance', async () => {
      const over = await call(
        'post',
        '/lab-billing/payments',
        {
          patientId: sana,
          amountMinor: 100_000,
          method: 'cash',
          allocations: [{ invoiceId, amountMinor: 200_000 }],
        },
        { key: randomUUID() },
      );
      expect(over.status).toBe(422);
      expect(code(over)).toBe('LAB_BILLING_ALLOCATION_EXCEEDS_PAYMENT');
      const aboveBalance = await call(
        'post',
        '/lab-billing/payments',
        {
          patientId: sana,
          amountMinor: 5_000_000,
          method: 'cash',
          allocations: [{ invoiceId, amountMinor: 2_000_000 }],
        },
        { key: randomUUID() },
      );
      expect(aboveBalance.status).toBe(422);
      expect(code(aboveBalance)).toBe('LAB_BILLING_ALLOCATION_EXCEEDS_BALANCE');
      const [{ n }] = await sqlRows<{ n: string }>(
        fx.dataSource,
        `SELECT count(*) AS n FROM lab_payments WHERE patient_id = $1`,
        [sana],
      );
      expect(Number(n)).toBe(0); // both rolled back, no receipt burnt
    });

    it('§10 concurrency: two desks paying the same balance at once — one wins, one is refused', async () => {
      const order = await submittedOrder(sana, 1);
      const inv = ok(
        await call('post', '/lab-billing/invoices', {
          orderId: order.id,
          issue: true,
        }),
        201,
      );
      const body = {
        patientId: sana,
        amountMinor: 1_500_000,
        method: 'cash',
        allocations: [{ invoiceId: inv.id, amountMinor: 1_500_000 }],
      };
      const [a, b] = await Promise.all([
        call('post', '/lab-billing/payments', body, { key: randomUUID() }),
        call('post', '/lab-billing/payments', body, { key: randomUUID() }),
      ]);
      // The loser waits on the invoice row lock, then sees it paid.
      const loser = a.status === 201 ? b : a;
      expect([a.status, b.status]).toContain(201);
      expect(code(loser)).toBe('LAB_BILLING_INVOICE_NOT_OPEN');
      expect(await invoice(inv.id)).toMatchObject({
        status: 'paid',
        paidMinor: 1_500_000,
        balanceMinor: 0,
      });
    });

    it('an unallocated payment is advance; issuing an invoice uses it (§6a)', async () => {
      const p = await pay({
        patientId: sana,
        amountMinor: 2_000_000,
        method: 'bank_transfer',
        autoAllocate: false,
      });
      expect(p).toMatchObject({ allocatedMinor: 0, advanceMinor: 2_000_000 });
      // Put the advance on the open invoice explicitly…
      ok(
        await call(
          'post',
          `/lab-billing/invoices/${invoiceId}/apply-advance`,
          {},
          { key: randomUUID() },
        ),
      );
      expect(await invoice(invoiceId)).toMatchObject({
        status: 'paid',
        balanceMinor: 0,
      });
      // …and a newly issued invoice takes the rest automatically.
      const manual = ok(
        await call(
          'post',
          '/lab-billing/invoices',
          {
            patientId: sana,
            issue: true,
            lines: [
              {
                kind: 'manual',
                description: 'Night guard adjustment',
                unitPriceMinor: 300_000,
              },
            ],
          },
          {},
        ),
        201,
      );
      expect(manual).toMatchObject({
        status: 'partially_paid',
        paidMinor: 245_000,
        balanceMinor: 55_000,
      });
    });

    it('inv. 4: every invoice total = Σ lines and balance = total − credits − active allocations ≥ 0', async () => {
      const bad = await sqlRows<{ id: string }>(
        fx.dataSource,
        `SELECT i.id FROM lab_invoices i
          WHERE i.status <> 'void' AND (
            i.total_minor <> COALESCE((SELECT SUM(l.line_total_minor) FROM lab_invoice_lines l WHERE l.invoice_id = i.id), 0)
            OR i.balance_minor <> i.total_minor - i.credited_minor - COALESCE(
                 (SELECT SUM(a.amount_minor) FROM lab_payment_allocations a
                   WHERE a.invoice_id = i.id AND a.reversed_at IS NULL), 0)
            OR i.balance_minor < 0)`,
      );
      expect(bad).toEqual([]);
      await expect(
        fx.dataSource.query(
          `UPDATE lab_invoices SET balance_minor = -1 WHERE id = $1`,
          [invoiceId],
        ),
      ).rejects.toThrow(/chk_lab_invoices_math/);
    });
  });

  describe('credit notes and refunds', () => {
    it('crediting a paid invoice releases money to advance, then it is refunded', async () => {
      const order = await submittedOrder(ali, 1);
      const inv = ok(
        await call('post', '/lab-billing/invoices', {
          orderId: order.id,
          issue: true,
        }),
        201,
      );
      await pay({
        patientId: ali,
        amountMinor: 1_500_000,
        method: 'cash',
        allocations: [{ invoiceId: inv.id, amountMinor: 1_500_000 }],
      });

      const credited = ok(
        await call(
          'post',
          `/lab-billing/invoices/${inv.id}/credit-notes`,
          { amountMinor: 500_000, reason: 'Shade remake not needed' },
          { key: randomUUID() },
        ),
        201,
      );
      expect(credited).toMatchObject({
        creditedMinor: 500_000,
        paidMinor: 1_000_000,
        balanceMinor: 0,
        status: 'paid',
      });
      const note = credited.creditNotes[0];
      expect(note).toMatchObject({
        amountMinor: 500_000,
        releasedMinor: 500_000,
        status: 'issued',
      });
      expect((await summary(ali)).advanceMinor).toBe(500_000);

      const tooMuch = await call(
        'post',
        `/lab-billing/invoices/${inv.id}/credit-notes`,
        { amountMinor: 1_000_001, reason: 'Too much' },
        { key: randomUUID() },
      );
      expect(code(tooMuch)).toBe('LAB_BILLING_CREDIT_EXCEEDS_INVOICE');

      const refundKey = randomUUID();
      const body = {
        patientId: ali,
        amountMinor: 500_000,
        method: 'cash',
        reason: 'Credit paid out',
        creditNoteId: note.id,
      };
      const r1 = ok(
        await call('post', '/lab-billing/refunds', body, { key: refundKey }),
        201,
      );
      const r2 = ok(
        await call('post', '/lab-billing/refunds', body, { key: refundKey }),
        201,
      );
      expect(r2.id).toBe(r1.id);
      expect(r1.summary.advanceMinor).toBe(0);
      expect((await invoice(inv.id)).creditNotes[0]).toMatchObject({
        refundedMinor: 500_000,
        status: 'refunded',
      });

      const noAdvance = await call(
        'post',
        '/lab-billing/refunds',
        { ...body, creditNoteId: undefined, amountMinor: 1 },
        { key: randomUUID() },
      );
      expect(code(noAdvance)).toBe('LAB_BILLING_REFUND_EXCEEDS_ADVANCE');
    });

    it('void only without money; voiding frees the items for a new invoice', async () => {
      const omar = await fx.dataSource.getRepository(Patient).save({
        organizationId: A.organizationId,
        patientNumber: `P-${randomUUID().slice(0, 6)}`,
        fullName: 'Omar Farooq',
        phone: '03001234569',
      } as Partial<Patient>);
      const order = await submittedOrder(omar.id, 1);
      const inv = ok(
        await call('post', '/lab-billing/invoices', {
          orderId: order.id,
          issue: true,
        }),
        201,
      );
      const voided = ok(
        await call('post', `/lab-billing/invoices/${inv.id}/void`, {
          version: inv.version,
          reason: 'Wrong patient',
        }),
      );
      expect(voided.status).toBe('void');
      const again = ok(
        await call('post', '/lab-billing/invoices', { orderId: order.id }),
        201,
      );
      expect(again.totalMinor).toBe(1_500_000);
    });
  });

  describe('§16 patient notifications', () => {
    const outbox = (entityId: string) =>
      sqlRows<{ channel: string; status: string; audience: string }>(
        fx.dataSource,
        `SELECT channel, status, audience FROM notification_outbox
          WHERE entity_id = $1 ORDER BY channel`,
        [entityId],
      );

    it('§19: patient notifications OFF (default) → skipped_disabled rows, nothing queued', async () => {
      const p = await pay({
        patientId: ali,
        amountMinor: 100,
        method: 'cash',
        autoAllocate: false,
      });
      const rows = await outbox(p.id);
      expect(rows.length).toBeGreaterThan(0);
      expect(
        rows.every(
          (r) => r.audience === 'patient' && r.status === 'skipped_disabled',
        ),
      ).toBe(true);
    });

    it('switched on → queued; patient opt-out → skipped_opt_out', async () => {
      ok(
        await call('patch', '/notification-settings/audiences/patient', {
          isEnabled: true,
        }),
      );
      ok(
        await call('put', '/notification-settings/rules', {
          rules: ['whatsapp', 'sms'].map((channel) => ({
            eventCode: 'payment.receipt',
            audience: 'patient',
            channel,
            isEnabled: true,
          })),
        }),
      );
      const p1 = await pay({
        patientId: ali,
        amountMinor: 100,
        method: 'cash',
        autoAllocate: false,
      });
      expect((await outbox(p1.id)).map((r) => r.status)).toEqual([
        'queued',
        'queued',
      ]);

      ok(
        await call('put', `/notification-settings/patients/${ali}/prefs`, {
          whatsappOptOut: true,
        }),
      );
      const p2 = await pay({
        patientId: ali,
        amountMinor: 100,
        method: 'cash',
        autoAllocate: false,
      });
      expect(await outbox(p2.id)).toEqual([
        { channel: 'sms', status: 'queued', audience: 'patient' },
        { channel: 'whatsapp', status: 'skipped_opt_out', audience: 'patient' },
      ]);
    });

    it('case complete: the order reaching `completed` tells the doctor and the patient', async () => {
      const order = await submittedOrder(ali, 1);
      await fx.dataSource.transaction((m) =>
        fx.app
          .get(OrderLifecycleHooks)
          .runStateChanged(m, order.id, 'completed'),
      );
      const rows = await sqlRows<{
        audience: string;
        channel: string;
        status: string;
      }>(
        fx.dataSource,
        `SELECT audience, channel, status FROM notification_outbox
          WHERE event_code = 'order.completed' AND entity_id = $1 ORDER BY audience, channel`,
        [order.id],
      );
      expect(
        rows.filter((r) => r.audience === 'doctor').map((r) => r.status),
      ).toContain('queued');
      // Patient audience is on, but this event's patient rules are still off.
      expect(
        rows
          .filter((r) => r.audience === 'patient')
          .every((r) => r.status === 'skipped_disabled'),
      ).toBe(true);
      expect(rows.some((r) => r.audience === 'patient')).toBe(true);
    });

    it('outstanding reminder goes through the same rules', async () => {
      const order = await submittedOrder(sana, 1);
      const inv = ok(
        await call('post', '/lab-billing/invoices', {
          orderId: order.id,
          issue: true,
        }),
        201,
      );
      const rows = ok(
        await call('post', `/lab-billing/invoices/${inv.id}/remind`),
      );
      // Rule for this event is still off (only payment.receipt was enabled).
      expect(rows.every((r: any) => r.status === 'skipped_disabled')).toBe(
        true,
      );
    });
  });

  describe('access', () => {
    it('front desk only: a doctor gets 403; another clinic sees nothing', async () => {
      const asDoctor = await call('get', '/lab-billing/invoices', undefined, {
        as: A.doctor,
      });
      expect(asDoctor.status).toBe(403);
      const [inv] = ok(await call('get', '/lab-billing/invoices')).data;
      const other = await call(
        'get',
        `/lab-billing/invoices/${inv.id}`,
        undefined,
        {
          clinic: fx.clinicB,
        },
      );
      expect(other.status).toBe(404);
      const list = ok(
        await call('get', '/lab-billing/invoices', undefined, {
          clinic: fx.clinicB,
        }),
      );
      expect(list.total).toBe(0);
    });
  });
});
