/* Supertest bodies are untyped JSON; these suites assert on their shape. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import type { Response } from 'supertest';
import { IsNull } from 'typeorm';
import {
  COMMISSIONS_FEATURE,
  CommissionBasis,
  CompensationPlanType,
} from 'src/billing/commissions/commission.enums';
import { CompensationPlan } from 'src/billing/commissions/entities/compensation-plan.entity';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { Expense } from 'src/billing/entities/expense.entity';
import {
  ExpenseCategory,
  ExpensePaymentMethod,
  ServiceKind,
} from 'src/billing/enums/billing.enums';
import { addDays, localDate } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { StageTemplate } from 'src/engine/entities/stage-template.entity';
import { LabAccessModule } from 'src/lab-access/lab-access.module';
import { LabBillingModule } from 'src/lab-billing/lab-billing.module';
import { ServiceCategory } from 'src/lab-catalog/entities/service-category.entity';
import { LabCatalogModule } from 'src/lab-catalog/lab-catalog.module';
import { LabFinanceModule } from 'src/lab-finance/lab-finance.module';
import { LabOrdersModule } from 'src/lab-orders/lab-orders.module';
import { LabPayablesModule } from 'src/lab-payables/lab-payables.module';
import { LabProductionModule } from 'src/lab-production/lab-production.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { Patient } from 'src/patients/entities/patient.entity';
import { Clinic, LabsFixture, createLabsFixture } from './labs-it.harness';

const ok = (res: Response, status = 200) => {
  if (res.status !== status)
    throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
};

/**
 * Sprint 11 — the whole case end to end with every lab module wired
 * together, as in the app (lab ERD §14 steps 2–9, §15 Ali example, §10
 * "Patient payment" / "Payment reversal", §19 acceptance): catalog price →
 * draft → submit (snapshot) → lab accept on the portal (vendor bill draft,
 * stages) → try-in correction round 2 → final receive → deliver (warranty)
 * → patient invoice + payments → doctor commission → vendor bill approve +
 * pay → balanced ledger → case profit. A catalog price change in the middle
 * must not touch the order or its invoice.
 */
describe('Lab case end to end (API)', () => {
  let fx: LabsFixture;
  let A: Clinic;
  let lab: { id: string };
  let labAdmin: { id: string; email: string };
  let otherLabAdmin: { id: string; email: string };
  let crown: { id: string };
  let crownPriceId: string;
  let treatment: CatalogService;
  let ali: string;
  let doctorEmployeeId: string;
  const today = localDate('Asia/Karachi', new Date());

  let order: {
    id: string;
    orderNo: string;
    items: { id: string; prices: Record<string, number> }[];
  };
  let pins: Array<{ id: string; wf: string; form: string | null }>;
  let invoiceId: string;
  let finalPaymentId: string;
  let billId: string;

  const http = () => request(fx.app.getHttpServer());
  const portal = (
    method: 'get' | 'post',
    url: string,
    body?: object,
    as: string = labAdmin.id,
  ) => http()[method](url).set('x-test-user', as).send(body);
  const doctor = (method: 'get' | 'post', url: string, body?: object) =>
    fx.clinic(method, url, A, A.doctor, body);
  /** Clinic admin; `key` → Idempotency-Key. */
  const admin = (
    method: 'get' | 'post' | 'patch',
    url: string,
    body?: object,
    key?: string,
  ) => {
    let r = http()
      [method](url)
      .set('x-test-user', A.admin)
      .set('x-organization-id', A.organizationId)
      .set('x-location-id', A.locationId);
    if (key) r = r.set('idempotency-key', key);
    return r.send(body);
  };

  const orderView = async () =>
    ok(await doctor('get', `/lab-orders/${order.id}`));
  const stagesOf = async (itemId: string) =>
    ok(await doctor('get', `/lab-orders/${order.id}/production`)).items.find(
      (i: { id: string }) => i.id === itemId,
    ).stages as Array<{
      id: string;
      seq: number;
      roundNo: number;
      status: string;
      isActive: boolean;
      isFinal: boolean;
    }>;
  const activeStage = async (itemId: string) =>
    (await stagesOf(itemId)).find((s) => s.isActive)!;
  const dispatchAll = async () =>
    ok(
      await portal('post', '/lab-portal/production/shipments', {
        courierName: 'TCS',
        lines: order.items.map((i) => ({ itemId: i.id })),
      }),
      201,
    );
  const receiveAll = async (shipment: { qrToken: string }) => {
    const s = ok(
      await doctor('get', `/lab-shipments/by-token/${shipment.qrToken}`),
    );
    return ok(
      await doctor('post', `/lab-shipments/${s.id}/receive`, {
        viaQr: true,
        lines: s.lines.map((l: { id: string; quantity: number }) => ({
          shipmentItemId: l.id,
          receivedQty: l.quantity,
          condition: 'ok',
          qcResult: 'pass',
        })),
      }),
    );
  };
  const decide = async (
    stageId: string,
    decision: 'approve' | 'correction',
    notes?: string,
  ) => {
    ok(
      await doctor(
        'post',
        `/lab-orders/${order.id}/stages/${stageId}/tryin`,
        {},
      ),
    );
    ok(
      await doctor(
        'post',
        `/lab-orders/${order.id}/stages/${stageId}/decision`,
        {
          decision,
          notes,
        },
      ),
    );
  };

  const invoice = async () =>
    ok(await admin('get', `/lab-billing/invoices/${invoiceId}`));
  const collect = async (amountMinor: number, key = randomUUID()) =>
    ok(
      await admin(
        'post',
        '/lab-billing/payments',
        {
          patientId: ali,
          amountMinor,
          method: 'cash',
          allocations: [{ invoiceId, amountMinor }],
        },
        key,
      ),
      201,
    );
  /** Σ commission entries on this order's lab invoice lines. */
  const commission = async () => {
    const [row] = await sqlRows<{ s: string; n: number }>(
      fx.dataSource,
      `SELECT COALESCE(SUM(ce.amount_minor), 0) AS s, count(*)::int AS n
         FROM commission_entries ce
         JOIN lab_invoice_lines l ON l.id = ce.lab_invoice_line_id
         JOIN lab_invoices i ON i.id = l.invoice_id
        WHERE i.order_id = $1`,
      [order.id],
    );
    return Number(row.s);
  };
  /** Debit − credit of one account over the whole org. */
  const balance = async (account: string) => {
    const [row] = await sqlRows<{ b: string }>(
      fx.dataSource,
      `SELECT COALESCE(SUM(debit_minor - credit_minor), 0) AS b FROM ledger_journal_lines
        WHERE organization_id = $1 AND account_code = $2`,
      [A.organizationId, account],
    );
    return Number(row.b);
  };
  /** Inv. 6: every journal of the org balances and matches its header total. */
  const assertLedgerBalanced = async () => {
    const rows = await sqlRows<{ d: string; c: string; total: string }>(
      fx.dataSource,
      `SELECT SUM(l.debit_minor) AS d, SUM(l.credit_minor) AS c, j.total_minor AS total
         FROM ledger_journals j JOIN ledger_journal_lines l ON l.journal_id = j.id
        WHERE j.organization_id = $1 GROUP BY j.id`,
      [A.organizationId],
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.d).toBe(r.c);
      expect(r.d).toBe(r.total);
    }
    const [all] = await sqlRows<{ d: string; c: string }>(
      fx.dataSource,
      `SELECT SUM(debit_minor) AS d, SUM(credit_minor) AS c FROM ledger_journal_lines WHERE organization_id = $1`,
      [A.organizationId],
    );
    expect(all.d).toBe(all.c);
  };

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_e2e_flow', [
      LabCatalogModule,
      LabOrdersModule,
      NotificationsModule,
      LabAccessModule,
      LabProductionModule,
      LabBillingModule,
      LabPayablesModule,
      LabFinanceModule,
    ]);
    A = fx.clinicA;
    const m = fx.dataSource.manager;
    const category = await m
      .getRepository(ServiceCategory)
      .findOneByOrFail({ code: 'CROWN' });
    const pfm3 = await m
      .getRepository(StageTemplate)
      .findOneByOrFail({ code: 'PFM_3_STAGE', organizationId: IsNull() });

    lab = ok(
      await fx.platform('post', '/platform/labs', fx.superAdmin, {
        name: `E2E Lab ${randomUUID().slice(0, 6)}`,
        labType: 'external',
        city: 'Lahore',
      }),
      201,
    );
    labAdmin = await fx.newUser('e2e-lab-admin');
    ok(
      await fx.platform(
        'post',
        `/platform/labs/${lab.id}/members`,
        fx.superAdmin,
        {
          email: labAdmin.email,
          role: 'lab_admin',
        },
      ),
      201,
    );
    const other = ok(
      await fx.platform('post', '/platform/labs', fx.superAdmin, {
        name: `E2E Other Lab ${randomUUID().slice(0, 6)}`,
        labType: 'external',
        city: 'Karachi',
      }),
      201,
    );
    otherLabAdmin = await fx.newUser('e2e-other-admin');
    ok(
      await fx.platform(
        'post',
        `/platform/labs/${other.id}/members`,
        fx.superAdmin,
        {
          email: otherLabAdmin.email,
          role: 'lab_admin',
        },
      ),
      201,
    );

    // §15: zirconia crown, lab PKR 5,000, clinic PKR 15,000 (3-stage try-in loop).
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
          stageTemplateId: pfm3.id,
        },
      ),
      201,
    );
    crownPriceId = ok(
      await fx.platform(
        'post',
        `/platform/labs/${lab.id}/services/${crown.id}/prices`,
        fx.superAdmin,
        { unitPriceMinor: 500_000, effectiveFrom: today },
      ),
      201,
    ).id;
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
    treatment = await m.getRepository(CatalogService).save({
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
    ali = (
      await m.getRepository(Patient).save({
        organizationId: A.organizationId,
        patientNumber: `P-${randomUUID().slice(0, 6)}`,
        fullName: 'Ali Ahmed',
        phone: '03001234599',
      } as Partial<Patient>)
    ).id;

    // The doctor earns 40% (NET) on collected lab work, net of lab cost.
    const assignment = await m
      .getRepository(EmployeeOrgLocationAssignment)
      .findOneByOrFail({
        userId: A.doctor,
        organizationId: A.organizationId,
        locationId: A.locationId,
      });
    doctorEmployeeId = assignment.employeeId;
    await m.getRepository(CompensationPlan).save({
      organizationId: A.organizationId,
      assignmentId: assignment.id,
      type: CompensationPlanType.COMMISSION,
      defaultRateBps: 4000,
      commissionBasis: CommissionBasis.NET,
      effectiveFrom: '2024-01-01',
    } as Partial<CompensationPlan>);
    await fx.flags.toggleFeature(A.organizationId, COMMISSIONS_FEATURE, true);
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  it('§14.2: the quote shows lab cost and patient price from the catalog', async () => {
    const q = ok(
      await doctor('get', `/lab-catalog/price-quote?labServiceId=${crown.id}`),
    );
    expect(q.lab.unitMinor).toBe(500_000);
    expect(q.patient.unitPriceMinor).toBe(1_500_000);
  });

  it('§14.2–4: a draft saves, submit freezes both prices, pins versions (inv. 7) and is idempotent (inv. 10)', async () => {
    const draft = ok(
      await doctor('post', '/lab-orders', {
        patientId: ali,
        labId: lab.id,
        items: [{ labServiceId: crown.id }, { labServiceId: crown.id }],
      }),
      201,
    );
    expect(draft.status).toBe('draft');
    const key = randomUUID();
    const submit = () =>
      http()
        .post(`/lab-orders/${draft.id}/submit`)
        .set('x-test-user', A.doctor)
        .set('x-organization-id', A.organizationId)
        .set('x-location-id', A.locationId)
        .set('idempotency-key', key)
        .send({ version: draft.version });
    order = ok(await submit(), 201);
    expect(order.orderNo).toBeTruthy();
    for (const item of order.items)
      expect(item.prices).toMatchObject({
        labUnitCostMinor: 500_000,
        labLineCostMinor: 500_000,
        patientUnitPriceMinor: 1_500_000,
        patientLinePriceMinor: 1_500_000,
      });
    const again = ok(await submit(), 201);
    expect(again.id).toBe(order.id);
    expect(again.orderNo).toBe(order.orderNo);

    pins = (
      await sqlRows<{ id: string; wf: string; form: string | null }>(
        fx.dataSource,
        `SELECT id, workflow_template_version_id AS wf, NULL AS form FROM lab_orders WHERE id = $1
         UNION ALL
         SELECT id, workflow_template_version_id, form_schema_version_id FROM lab_order_items WHERE order_id = $1`,
        [order.id],
      )
    ).sort((a, b) => a.id.localeCompare(b.id));
    expect(pins).toHaveLength(3);
  });

  it('§19: a catalog price change does not touch the submitted order', async () => {
    await fx.dataSource.query(
      `UPDATE lab_service_prices SET unit_price_minor = 700000 WHERE id = $1`,
      [crownPriceId],
    );
    await fx.dataSource.query(
      `UPDATE services SET default_price = 20000 WHERE id = $1`,
      [treatment.id],
    );
    const q = ok(
      await doctor('get', `/lab-catalog/price-quote?labServiceId=${crown.id}`),
    );
    expect(q.lab.unitMinor).toBe(700_000);
    expect(q.patient.unitPriceMinor).toBe(2_000_000);
    const view = await orderView();
    for (const item of view.items)
      expect(item.prices).toMatchObject({
        labLineCostMinor: 500_000,
        patientLinePriceMinor: 1_500_000,
      });
  });

  it('§14.5: the lab accepts on the portal → vendor bill draft 10,000 (nothing in the ledger), round-1 stages', async () => {
    // Another lab can't even see it (§19 / inv. 2).
    expect(
      (
        await portal(
          'get',
          `/lab-portal/orders/${order.id}`,
          undefined,
          otherLabAdmin.id,
        )
      ).status,
    ).toBe(404);
    ok(
      await portal('post', `/lab-portal/orders/${order.id}/accept`, {
        labExpectedOn: addDays(today, 10),
      }),
      201,
    );
    expect((await orderView()).status).toBe('accepted');
    const [bill] = ok(
      await admin('get', `/lab-payables/bills?labOrderId=${order.id}`),
    ).data;
    billId = bill.id;
    expect(bill).toMatchObject({ status: 'draft', totalMinor: 1_000_000 });
    const [{ n }] = await sqlRows<{ n: number }>(
      fx.dataSource,
      `SELECT count(*)::int AS n FROM ledger_journals WHERE source_id = $1`,
      [billId],
    );
    expect(n).toBe(0);
    for (const item of order.items) {
      const stages = await stagesOf(item.id);
      expect(stages.map((s) => [s.seq, s.roundNo, s.status])).toEqual([
        [1, 1, 'pending'],
        [2, 1, 'pending'],
        [3, 1, 'pending'],
      ]);
    }
  });

  it('§14.6: try-in correction → round 2 of the same stage, round 1 preserved; then approved', async () => {
    for (const item of order.items)
      ok(
        await portal(
          'post',
          `/lab-portal/production/items/${item.id}/start`,
          {},
        ),
      );
    await receiveAll(await dispatchAll());
    const [first, second] = order.items;
    await decide(
      (await activeStage(first.id)).id,
      'correction',
      'Margin open on 16',
    );
    await decide((await activeStage(second.id)).id, 'approve');

    const seq1 = (await stagesOf(first.id)).filter((s) => s.seq === 1);
    expect(seq1.map((s) => [s.roundNo, s.status])).toEqual([
      [1, 'correction'],
      [2, 'at_lab'],
    ]);
    // The lab ships round 2 alone; the clinic approves it.
    const r2 = ok(
      await portal('post', '/lab-portal/production/shipments', {
        lines: [{ itemId: first.id }],
      }),
      201,
    );
    await receiveAll(r2);
    await decide((await activeStage(first.id)).id, 'approve');
    expect(
      (await stagesOf(first.id)).map((s) => [s.seq, s.roundNo, s.status]),
    ).toEqual([
      [1, 1, 'correction'],
      [1, 2, 'approved'],
      [2, 1, 'at_lab'],
      [3, 1, 'pending'],
    ]);
    // Bisque try-in for both, approved.
    await receiveAll(await dispatchAll());
    for (const item of order.items)
      await decide((await activeStage(item.id)).id, 'approve');
  });

  it('§14.7–8: final work → QC → receive → approve → deliver; the warranty starts', async () => {
    for (const item of order.items) {
      ok(
        await portal(
          'post',
          `/lab-portal/production/items/${item.id}/finish`,
          {},
        ),
      );
      ok(
        await portal('post', `/lab-portal/production/items/${item.id}/qc`, {
          result: 'pass',
        }),
      );
    }
    expect((await orderView()).status).toBe('ready');
    await receiveAll(await dispatchAll());
    for (const item of order.items) {
      const final = (await stagesOf(item.id)).find((s) => s.isFinal)!;
      await decide(final.id, 'approve');
    }
    expect((await orderView()).status).toBe('completed');
    for (const item of order.items)
      ok(
        await doctor(
          'post',
          `/lab-orders/${order.id}/items/${item.id}/deliver`,
          {},
        ),
      );
    const view = ok(await doctor('get', `/lab-orders/${order.id}/production`));
    for (const item of view.items)
      expect(item).toMatchObject({
        status: 'delivered',
        warranty: { startsOn: today },
      });
  });

  it('§15 step 1: invoice from the frozen prices (not the new catalog) − 2,000 → 28,000; receivable journal', async () => {
    const draft = ok(
      await admin('post', '/lab-billing/invoices', {
        orderId: order.id,
        discountMinor: 200_000,
      }),
      201,
    );
    invoiceId = draft.id;
    expect(draft.subtotalMinor).toBe(3_000_000);
    const inv = ok(
      await admin('post', `/lab-billing/invoices/${invoiceId}/issue`, {
        version: draft.version,
      }),
    );
    expect(inv).toMatchObject({
      status: 'issued',
      totalMinor: 2_800_000,
      balanceMinor: 2_800_000,
    });
    expect(await balance('PATIENT_RECEIVABLE')).toBe(2_800_000);
    expect(await balance('LAB_REVENUE')).toBe(-2_800_000);
    // Commission is snapshotted at issue (40%), nothing earned yet.
    const lines = await sqlRows<{ rate: number; doctor: string }>(
      fx.dataSource,
      `SELECT commission_rate_bps AS rate, doctor_id AS doctor FROM lab_invoice_lines WHERE invoice_id = $1`,
      [invoiceId],
    );
    expect(lines).toEqual([
      { rate: 4000, doctor: doctorEmployeeId },
      { rate: 4000, doctor: doctorEmployeeId },
    ]);
    expect(await commission()).toBe(0);
  });

  it('§15 step 2: advance 10,000 → receivable 18,000, commission accrues pro rata', async () => {
    await collect(1_000_000);
    expect(await invoice()).toMatchObject({
      status: 'partially_paid',
      balanceMinor: 1_800_000,
    });
    // 5,000 of each crown collected: 5,000 × (14,000 − 5,000) × 40% / 14,000.
    expect(await commission()).toBe(2 * 128_571);
    expect(await balance('CASH')).toBe(1_000_000);
    expect(await balance('PATIENT_RECEIVABLE')).toBe(1_800_000);
  });

  it('§15 step 4: a courier expense of 500 is linked to the case', async () => {
    await fx.dataSource.getRepository(Expense).save({
      organizationId: A.organizationId,
      locationId: A.locationId,
      category: ExpenseCategory.OTHER,
      description: 'Courier',
      amount: 500,
      expenseDate: new Date(),
      paymentMethod: ExpensePaymentMethod.CASH,
      labId: lab.id,
      labOrderId: order.id,
    } as Partial<Expense>);
  });

  it('§15 steps 5, 6, 8: vendor bill approved → payable 10,000; paid 6,000 + 4,000 → 0', async () => {
    const b = ok(await admin('get', `/lab-payables/bills/${billId}`));
    ok(
      await admin('post', `/lab-payables/bills/${billId}/approve`, {
        version: b.version,
        vendorInvoiceNo: `E2E-${randomUUID().slice(0, 6)}`,
      }),
    );
    expect(await balance('LAB_PAYABLE')).toBe(-1_000_000);
    for (const amountMinor of [600_000, 400_000])
      ok(
        await admin(
          'post',
          '/lab-payables/payments',
          {
            labId: lab.id,
            amountMinor,
            method: 'bank_transfer',
            allocations: [{ billId, amountMinor }],
          },
          randomUUID(),
        ),
        201,
      );
    expect(
      ok(await admin('get', `/lab-payables/bills/${billId}`)),
    ).toMatchObject({
      status: 'paid',
      balanceMinor: 0,
    });
    expect(await balance('LAB_PAYABLE')).toBe(0);
    expect(await balance('LAB_COST')).toBe(1_000_000);
  });

  it('§15 step 7: Ali pays 18,000 → paid, receivable 0; commission 7,200 = 40% × (28,000 − 10,000)', async () => {
    finalPaymentId = (await collect(1_800_000)).id;
    expect(await invoice()).toMatchObject({ status: 'paid', balanceMinor: 0 });
    expect(await balance('PATIENT_RECEIVABLE')).toBe(0);
    expect(await commission()).toBe(720_000);
    expect(await balance('COMMISSION_PAYABLE')).toBe(-720_000);
    expect(await balance('COMMISSION_EXPENSE')).toBe(720_000);
    await assertLedgerBalanced();
  });

  it('§19: after a payment reversal invoice balance, commission and ledger are all back — and the correct entry restores them', async () => {
    const rev = await admin(
      'post',
      `/lab-billing/payments/${finalPaymentId}/reverse`,
      { reason: 'Wrong patient' },
      randomUUID(),
    );
    expect(rev.status).toBe(200);
    expect(await invoice()).toMatchObject({
      status: 'partially_paid',
      paidMinor: 1_000_000,
      balanceMinor: 1_800_000,
    });
    // Back to what the 10,000 advance earned.
    expect(await commission()).toBe(2 * 128_571);
    expect(await balance('COMMISSION_PAYABLE')).toBe(-2 * 128_571);
    expect(await balance('PATIENT_RECEIVABLE')).toBe(1_800_000);
    expect(await balance('PATIENT_ADVANCES')).toBe(0);
    expect(await balance('CASH')).toBe(1_000_000);
    await assertLedgerBalanced();
    // Nothing was deleted: the reversed commission is a negative entry.
    const [{ neg }] = await sqlRows<{ neg: number }>(
      fx.dataSource,
      `SELECT count(*)::int AS neg FROM commission_entries ce
         JOIN lab_invoice_lines l ON l.id = ce.lab_invoice_line_id
        WHERE l.invoice_id = $1 AND ce.amount_minor < 0 AND ce.source_type = 'UNAPPLY'`,
      [invoiceId],
    );
    expect(neg).toBe(2);

    // "Ghalat entry: reversal entry aur phir sahi entry."
    await collect(1_800_000);
    expect(await invoice()).toMatchObject({ status: 'paid', balanceMinor: 0 });
    expect(await commission()).toBe(720_000);
    expect(await balance('PATIENT_RECEIVABLE')).toBe(0);
    expect(await balance('CASH')).toBe(2_800_000);
    await assertLedgerBalanced();
  });

  it('§15: case profit = 28,000 − 10,000 − 500 = 17,500 gross, minus 7,200 commission', async () => {
    const report = ok(
      await admin('get', `/lab-payables/reports/case-profit?labId=${lab.id}`),
    );
    const row = report.data.find((r: any) => r.orderId === order.id);
    expect(row).toMatchObject({
      patientPriceMinor: 3_000_000,
      invoicedMinor: 2_800_000,
      collectedMinor: 2_800_000,
      labCostMinor: 1_000_000,
      billedLabCostMinor: 1_000_000,
      expensesMinor: 50_000,
      commissionMinor: 720_000,
      profitMinor: 2_800_000 - 1_000_000 - 50_000 - 720_000,
    });
  });

  it('§19: the issued invoice still carries the old (frozen) amounts after the catalog change', async () => {
    const inv = await invoice();
    expect(inv.totalMinor).toBe(2_800_000);
    expect(inv.lines.map((l: any) => l.unitPriceMinor)).toEqual([
      1_500_000, 1_500_000,
    ]);
  });

  it('inv. 7: workflow and form versions never changed during the case', async () => {
    const now = (
      await sqlRows<{ id: string; wf: string; form: string | null }>(
        fx.dataSource,
        `SELECT id, workflow_template_version_id AS wf, NULL AS form FROM lab_orders WHERE id = $1
         UNION ALL
         SELECT id, workflow_template_version_id, form_schema_version_id FROM lab_order_items WHERE order_id = $1`,
        [order.id],
      )
    ).sort((a, b) => a.id.localeCompare(b.id));
    expect(now).toEqual(pins);
  });

  it('inv. 4 + 5: invoice math and payment limits hold for the whole org', async () => {
    const bad = await sqlRows(
      fx.dataSource,
      `SELECT i.id FROM lab_invoices i
        WHERE i.organization_id = $1 AND i.status <> 'draft' AND (
              i.total_minor <> COALESCE((SELECT SUM(l.line_total_minor) FROM lab_invoice_lines l WHERE l.invoice_id = i.id), 0)
           OR i.balance_minor <> i.total_minor - i.credited_minor
                - COALESCE((SELECT SUM(a.amount_minor) FROM lab_payment_allocations a
                             WHERE a.invoice_id = i.id AND a.reversed_at IS NULL), 0)
           OR i.balance_minor < 0)
       UNION ALL
       SELECT p.id FROM lab_payments p
        WHERE p.organization_id = $1 AND p.amount_minor > 0 AND p.amount_minor <
              COALESCE((SELECT SUM(a.amount_minor) FROM lab_payment_allocations a
                         WHERE a.payment_id = p.id AND a.reversed_at IS NULL), 0)`,
      [A.organizationId],
    );
    expect(bad).toEqual([]);
  });

  it('inv. 1: no row points at a parent of another organization', async () => {
    const leaks = await sqlRows<{ what: string; n: number }>(
      fx.dataSource,
      `SELECT 'item→order' AS what, count(*)::int AS n FROM lab_order_items i JOIN lab_orders o ON o.id = i.order_id WHERE i.organization_id <> o.organization_id
       UNION ALL SELECT 'order→patient', count(*)::int FROM lab_orders o JOIN patients p ON p.id = o.patient_id WHERE o.organization_id <> p.organization_id
       UNION ALL SELECT 'invoice→patient', count(*)::int FROM lab_invoices i JOIN patients p ON p.id = i.patient_id WHERE i.organization_id <> p.organization_id
       UNION ALL SELECT 'invoice→order', count(*)::int FROM lab_invoices i JOIN lab_orders o ON o.id = i.order_id WHERE i.organization_id <> o.organization_id
       UNION ALL SELECT 'line→invoice', count(*)::int FROM lab_invoice_lines l JOIN lab_invoices i ON i.id = l.invoice_id WHERE l.organization_id <> i.organization_id
       UNION ALL SELECT 'allocation→payment/invoice', count(*)::int FROM lab_payment_allocations a
                   JOIN lab_payments p ON p.id = a.payment_id JOIN lab_invoices i ON i.id = a.invoice_id WHERE p.organization_id <> i.organization_id
       UNION ALL SELECT 'bill→order', count(*)::int FROM vendor_bills b JOIN lab_orders o ON o.id = b.lab_order_id WHERE b.organization_id <> o.organization_id
       UNION ALL SELECT 'commission→line', count(*)::int FROM commission_entries ce JOIN lab_invoice_lines l ON l.id = ce.lab_invoice_line_id WHERE ce.organization_id <> l.organization_id
       UNION ALL SELECT 'journal line→journal', count(*)::int FROM ledger_journal_lines l JOIN ledger_journals j ON j.id = l.journal_id WHERE l.organization_id <> j.organization_id`,
    );
    expect(leaks.filter((l) => l.n > 0)).toEqual([]);
  });

  it('security: an order cannot point at a treatment record of another clinic or patient', async () => {
    const res = await doctor('post', '/lab-orders', {
      patientId: ali,
      labId: lab.id,
      treatmentId: randomUUID(),
      items: [{ labServiceId: crown.id }],
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body?.error?.code ?? res.body?.code).toBe('LAB_ORDER_INVALID');
  });

  it('§19: the lab never sees clinic selling prices, invoices or the patient’s medical record', async () => {
    const view = ok(await portal('get', `/lab-portal/orders/${order.id}`));
    const json = JSON.stringify(view);
    for (const leak of [
      'patientUnitPriceMinor',
      'patientLinePriceMinor',
      'patientPrice',
      'invoiceNo',
      'LINV-',
      'medicalHistory',
      'allergies',
      'phone',
    ])
      expect(json).not.toContain(leak);
    expect(json).not.toContain('1500000');
    const bills = ok(await portal('get', '/lab-portal/payables/bills'));
    expect(JSON.stringify(bills)).not.toMatch(/patient.*Price|commission/i);
    // Clinic billing routes are not reachable with a lab login.
    const asLab = await http()
      .get('/lab-billing/invoices')
      .set('x-test-user', labAdmin.id)
      .set('x-organization-id', A.organizationId)
      .set('x-location-id', A.locationId);
    expect([401, 403, 404]).toContain(asLab.status);
    expect(
      (
        await http()
          .get('/lab-billing/invoices')
          .set('x-test-user', labAdmin.id)
      ).status,
    ).not.toBe(200);
  });
});
