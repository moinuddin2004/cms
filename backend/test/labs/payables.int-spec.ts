/* Supertest bodies are untyped JSON; these suites assert on their shape. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import type { Response } from 'supertest';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { Expense } from 'src/billing/entities/expense.entity';
import {
  ExpenseCategory,
  ExpensePaymentMethod,
  ServiceKind,
} from 'src/billing/enums/billing.enums';
import { addDays, localDate } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import type { TransitionActor } from 'src/engine/runtime/runtime.types';
import { WorkflowEngine } from 'src/engine/runtime/workflow-engine.service';
import { ServiceCategory } from 'src/lab-catalog/entities/service-category.entity';
import { LabCatalogModule } from 'src/lab-catalog/lab-catalog.module';
import { LabOrdersModule } from 'src/lab-orders/lab-orders.module';
import { LabPayablesModule } from 'src/lab-payables/lab-payables.module';
import { LabProductionModule } from 'src/lab-production/lab-production.module';
import { Patient } from 'src/patients/entities/patient.entity';
import { Clinic, LabsFixture, createLabsFixture } from './labs-it.harness';

const code = (res: Response): string | undefined =>
  (res.body?.error?.code ?? res.body?.code) as string | undefined;

/**
 * Sprint 10 — lab payables (lab ERD §6b, §6c, §10 "Vendor bill approve",
 * inv. 5 + 6, §15): draft bill at lab accept, remake lines per
 * responsibility, approval into balanced journals, payment allocation
 * limits and reversal, statement reconciliation, the lab's read-only view.
 */
describe('Lab payables (API)', () => {
  let fx: LabsFixture;
  let A: Clinic;
  let engine: WorkflowEngine;
  let lab: { id: string };
  let labAdmin: { id: string; email: string };
  let otherLabAdmin: { id: string; email: string };
  let crown: { id: string };
  let guard: { id: string };
  let patientId: string;
  const today = localDate('Asia/Karachi', new Date());

  const portal = (
    method: 'get' | 'post',
    url: string,
    body?: object,
    as: string = labAdmin.id,
  ) =>
    request(fx.app.getHttpServer())
      [method](url)
      .set('x-test-user', as)
      .send(body);
  const admin = (
    method: 'get' | 'post' | 'patch',
    url: string,
    body?: object,
  ) => fx.clinic(method, url, A, A.admin, body);
  const ok = (res: Response, status = 200) => {
    if (res.status !== status)
      throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
    return res.body.data;
  };

  const submitted = async (services: string[]) => {
    const d = await fx.clinic('post', '/lab-orders', A, A.doctor, {
      patientId,
      labId: lab.id,
      items: services.map((labServiceId) => ({ labServiceId })),
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
    return s.body.data as {
      id: string;
      orderNo: string;
      items: { id: string; prices: Record<string, number> }[];
    };
  };

  const accept = (itemId: string) =>
    engine.transition({
      organizationId: A.organizationId,
      entityType: 'item',
      entityId: itemId,
      action: 'accept',
      actor: {
        userId: labAdmin.id,
        side: 'lab',
        roles: ['lab_admin'],
      } satisfies TransitionActor,
      input: { lab_expected_on: addDays(today, 7) },
    });

  const billsOf = async (orderId: string) =>
    ok(await admin('get', `/lab-payables/bills?labOrderId=${orderId}`))
      .data as any[];
  const bill = async (id: string) =>
    ok(await admin('get', `/lab-payables/bills/${id}`));
  const approve = async (id: string, extra: object = {}) => {
    const b = await bill(id);
    return ok(
      await admin('post', `/lab-payables/bills/${id}/approve`, {
        version: b.version,
        ...extra,
      }),
    );
  };
  const pay = (body: object, key?: string) => {
    const r = request(fx.app.getHttpServer())
      .post('/lab-payables/payments')
      .set('x-test-user', A.admin)
      .set('x-organization-id', A.organizationId)
      .set('x-location-id', A.locationId);
    if (key) r.set('idempotency-key', key);
    return r.send({ labId: lab.id, method: 'bank_transfer', ...body });
  };

  /** Every journal of the org balances (inv. 6). */
  const assertLedgerBalanced = async () => {
    const rows = await sqlRows<{
      id: string;
      d: string;
      c: string;
      total: string;
    }>(
      fx.dataSource,
      `SELECT j.id, SUM(l.debit_paisa) AS d, SUM(l.credit_paisa) AS c, j.total_paisa AS total
         FROM ledger_journals j JOIN ledger_journal_lines l ON l.journal_id = j.id
        WHERE j.organization_id = $1 GROUP BY j.id`,
      [A.organizationId],
    );
    for (const r of rows) {
      expect(r.d).toBe(r.c);
      expect(r.d).toBe(r.total);
    }
    return rows.length;
  };
  const accountBalance = async (account: string) => {
    const [row] = await sqlRows<{ b: string }>(
      fx.dataSource,
      `SELECT COALESCE(SUM(debit_paisa - credit_paisa), 0) AS b FROM ledger_journal_lines
        WHERE organization_id = $1 AND account_code = $2 AND lab_id = $3`,
      [A.organizationId, account, lab.id],
    );
    return Number(row.b);
  };

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_payables_api', [
      LabCatalogModule,
      LabOrdersModule,
      LabProductionModule,
      LabPayablesModule,
    ]);
    A = fx.clinicA;
    engine = fx.app.get(WorkflowEngine);
    const m = fx.dataSource.manager;
    const category = await m
      .getRepository(ServiceCategory)
      .findOneByOrFail({ code: 'CROWN' });

    const created = await fx.platform('post', '/platform/labs', fx.superAdmin, {
      name: `Payables IT Lab ${randomUUID().slice(0, 6)}`,
      labType: 'external',
      city: 'Lahore',
    });
    lab = created.body.data;
    labAdmin = await fx.newUser('pay-lab-admin');
    await fx.platform(
      'post',
      `/platform/labs/${lab.id}/members`,
      fx.superAdmin,
      {
        email: labAdmin.email,
        role: 'lab_admin',
      },
    );
    const other = await fx.platform('post', '/platform/labs', fx.superAdmin, {
      name: `Other Payables Lab ${randomUUID().slice(0, 6)}`,
      labType: 'external',
      city: 'Karachi',
    });
    otherLabAdmin = await fx.newUser('pay-other-admin');
    await fx.platform(
      'post',
      `/platform/labs/${other.body.data.id}/members`,
      fx.superAdmin,
      {
        email: otherLabAdmin.email,
        role: 'lab_admin',
      },
    );

    const service = async (svcCode: string, name: string, paisa: number) => {
      const s = await fx.platform(
        'post',
        `/platform/labs/${lab.id}/services`,
        fx.superAdmin,
        {
          categoryId: category.id,
          code: svcCode,
          name,
          unitType: 'per_case',
          defaultTurnaroundDays: 5,
          stageTemplateId: null,
        },
      );
      expect(s.status).toBe(201);
      const p = await fx.platform(
        'post',
        `/platform/labs/${lab.id}/services/${s.body.data.id}/prices`,
        fx.superAdmin,
        { unitPricePaisa: paisa, effectiveFrom: today },
      );
      expect(p.status).toBe(201);
      return s.body.data as { id: string };
    };
    crown = await service('zirconia_crown', 'Zirconia crown', 500_000);
    guard = await service('night_guard', 'Night guard', 200_000);

    const link = await fx.clinic('post', '/lab-links', A, A.admin, {
      labId: lab.id,
    });
    await fx.clinic(
      'post',
      `/lab-links/${link.body.data.id}/transitions`,
      A,
      A.admin,
      {
        action: 'activate',
        version: 1,
      },
    );
    for (const [labServiceId, price, name] of [
      [crown.id, 15_000, 'Zirconia crown'],
      [guard.id, 6_000, 'Night guard'],
    ] as const) {
      const t = await m.getRepository(CatalogService).save({
        organizationId: A.organizationId,
        name,
        kind: ServiceKind.PROCEDURE,
        defaultPrice: price,
      });
      const map = await fx.clinic('post', '/lab-catalog/mappings', A, A.admin, {
        clinicTreatmentId: t.id,
        labServiceId,
      });
      expect(map.status).toBe(201);
    }
    const patient = await m.getRepository(Patient).save({
      organizationId: A.organizationId,
      patientNumber: `P-${randomUUID().slice(0, 6)}`,
      fullName: 'Ali Ahmed',
      phone: '03001234511',
    } as Partial<Patient>);
    patientId = patient.id;
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  describe('§15 worked example: draft at accept → approve → pay in two parts', () => {
    let order: Awaited<ReturnType<typeof submitted>>;
    let billId: string;

    beforeAll(async () => {
      order = await submitted([crown.id, crown.id]);
    });

    it('nothing is billed before the lab accepts', async () => {
      expect(await billsOf(order.id)).toEqual([]);
    });

    it('lab accept creates one draft per order from the items’ lab cost; nothing in the ledger', async () => {
      await accept(order.items[0].id);
      let [draft] = await billsOf(order.id);
      expect(draft).toMatchObject({
        status: 'draft',
        totalPaisa: 500_000,
        orderNo: order.orderNo,
      });
      await accept(order.items[1].id);
      const bills = await billsOf(order.id);
      expect(bills).toHaveLength(1);
      [draft] = bills;
      billId = draft.id;
      const full = await bill(billId);
      expect(full).toMatchObject({
        status: 'draft',
        subtotalPaisa: 1_000_000,
        totalPaisa: 1_000_000,
      });
      expect(
        full.lines.map((l: any) => [
          l.lineKind,
          l.orderItemId,
          l.lineTotalPaisa,
        ]),
      ).toEqual([
        ['service', order.items[0].id, 500_000],
        ['service', order.items[1].id, 500_000],
      ]);
      const [{ n }] = await sqlRows<{ n: number }>(
        fx.dataSource,
        `SELECT count(*)::int AS n FROM ledger_journals WHERE source_id = $1`,
        [billId],
      );
      expect(n).toBe(0);
      // Idempotent re-sync.
      const again = ok(
        await admin('post', `/lab-payables/orders/${order.id}/sync`),
      );
      expect(again).toEqual({ billId, changed: false });
    });

    it('doctors and receptionists cannot reach payables', async () => {
      const res = await fx.clinic('get', '/lab-payables/bills', A, A.doctor);
      expect(res.status).toBe(403);
    });

    it('approve posts one balanced Lab Cost / Lab Payable journal; a stale version is refused', async () => {
      const b = await bill(billId);
      const stale = await admin(
        'post',
        `/lab-payables/bills/${billId}/approve`,
        { version: b.version + 5 },
      );
      expect(code(stale)).toBe('STALE_VERSION');
      const approved = await approve(billId, { vendorInvoiceNo: 'SMILE-1001' });
      expect(approved).toMatchObject({
        status: 'approved',
        balancePaisa: 1_000_000,
        paidPaisa: 0,
        vendorInvoiceNo: 'SMILE-1001',
      });
      expect(approved.dueOn).toBe(addDays(approved.billDate, 30));
      const lines = await sqlRows<{
        account_code: string;
        debit_paisa: string;
        credit_paisa: string;
      }>(
        fx.dataSource,
        `SELECT l.account_code, l.debit_paisa, l.credit_paisa FROM ledger_journal_lines l
           JOIN ledger_journals j ON j.id = l.journal_id
          WHERE j.source_type = 'vendor_bill' AND j.source_id = $1 ORDER BY l.account_code`,
        [billId],
      );
      expect(lines).toEqual([
        { account_code: 'LAB_COST', debit_paisa: '1000000', credit_paisa: '0' },
        {
          account_code: 'LAB_PAYABLE',
          debit_paisa: '0',
          credit_paisa: '1000000',
        },
      ]);
      expect(await accountBalance('LAB_PAYABLE')).toBe(-1_000_000);
      const twice = await admin(
        'post',
        `/lab-payables/bills/${billId}/approve`,
        { version: approved.version },
      );
      expect(code(twice)).toBe('PAYABLES_NOT_ALLOWED');
    });

    it('allocation limits (inv. 5): not over the payment, not over the bill balance', async () => {
      const overPayment = await pay({
        amountPaisa: 100_000,
        allocations: [{ billId, amountPaisa: 200_000 }],
      });
      expect(code(overPayment)).toBe('PAYABLES_ALLOCATION_LIMIT');
      const overBalance = await pay({
        amountPaisa: 2_000_000,
        allocations: [{ billId, amountPaisa: 1_500_000 }],
      });
      expect(code(overBalance)).toBe('PAYABLES_ALLOCATION_LIMIT');
      const [{ n }] = await sqlRows<{ n: number }>(
        fx.dataSource,
        `SELECT count(*)::int AS n FROM vendor_payments WHERE organization_id = $1`,
        [A.organizationId],
      );
      expect(n).toBe(0);
    });

    it('pay 6,000 then 4,000: partially_paid → paid, Lab Payable back to 0; idempotent', async () => {
      const key = randomUUID();
      const first = ok(
        await pay(
          {
            amountPaisa: 600_000,
            allocations: [{ billId, amountPaisa: 600_000 }],
          },
          key,
        ),
        201,
      );
      const replay = ok(
        await pay(
          {
            amountPaisa: 600_000,
            allocations: [{ billId, amountPaisa: 600_000 }],
          },
          key,
        ),
        201,
      );
      expect(replay.id).toBe(first.id);
      expect((await bill(billId)).status).toBe('partially_paid');
      expect((await bill(billId)).balancePaisa).toBe(400_000);
      ok(
        await pay({
          amountPaisa: 400_000,
          method: 'cash',
          allocations: [{ billId, amountPaisa: 400_000 }],
        }),
        201,
      );
      const paid = await bill(billId);
      expect(paid).toMatchObject({
        status: 'paid',
        balancePaisa: 0,
        paidPaisa: 1_000_000,
      });
      expect(paid.allocations).toHaveLength(2);
      expect(await accountBalance('LAB_PAYABLE')).toBe(0);
      expect(await accountBalance('LAB_COST')).toBe(1_000_000);
      const more = await pay({
        amountPaisa: 100,
        allocations: [{ billId, amountPaisa: 100 }],
      });
      expect(code(more)).toBe('PAYABLES_NOT_ALLOWED');
      expect(await assertLedgerBalanced()).toBeGreaterThanOrEqual(3);
    });

    it('a case expense (courier) is part of case profit', async () => {
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
      const report = ok(
        await admin('get', `/lab-payables/reports/case-profit?labId=${lab.id}`),
      );
      const row = report.data.find((r: any) => r.orderId === order.id);
      expect(row).toMatchObject({
        patientPricePaisa: 3_000_000,
        labCostPaisa: 1_000_000,
        billedLabCostPaisa: 1_000_000,
        expensesPaisa: 50_000,
        profitPaisa: 1_950_000,
        // Nothing invoiced to the patient yet (Sprint 11): price snapshot, no commission.
        invoicedPaisa: null,
        commissionPaisa: 0,
      });
    });
  });

  describe('advance, reversal, void', () => {
    it('an unallocated rest is a lab advance, applied later; a reversal mirrors every journal', async () => {
      const order = await submitted([guard.id]);
      await accept(order.items[0].id);
      const [draft] = await billsOf(order.id);
      const b = await approve(draft.id);
      const p = ok(
        await pay({
          amountPaisa: 300_000,
          allocations: [{ billId: b.id, amountPaisa: 100_000 }],
        }),
        201,
      );
      expect(p).toMatchObject({
        allocatedPaisa: 100_000,
        unallocatedPaisa: 200_000,
      });
      expect(await accountBalance('LAB_ADVANCES')).toBe(200_000);
      const tooMuch = await admin(
        'post',
        `/lab-payables/payments/${p.id}/allocations`,
        {
          version: p.version,
          allocations: [{ billId: b.id, amountPaisa: 250_000 }],
        },
      );
      expect(code(tooMuch)).toBe('PAYABLES_ALLOCATION_LIMIT');
      const applied = ok(
        await admin('post', `/lab-payables/payments/${p.id}/allocations`, {
          version: p.version,
          allocations: [{ billId: b.id, amountPaisa: 100_000 }],
        }),
        201,
      );
      expect(applied.unallocatedPaisa).toBe(100_000);
      expect((await bill(b.id)).status).toBe('paid');
      expect(await accountBalance('LAB_ADVANCES')).toBe(100_000);

      const voidPaid = await admin('post', `/lab-payables/bills/${b.id}/void`, {
        version: (await bill(b.id)).version,
        reason: 'Wrong lab',
      });
      expect(code(voidPaid)).toBe('PAYABLES_NOT_ALLOWED');

      const reversed = ok(
        await admin('post', `/lab-payables/payments/${p.id}/reverse`, {
          version: applied.version,
          reason: 'Entered twice',
        }),
      );
      expect(reversed.status).toBe('reversed');
      expect(reversed.allocations.every((a: any) => a.reversedAt)).toBe(true);
      expect(await bill(b.id)).toMatchObject({
        status: 'approved',
        balancePaisa: 200_000,
        paidPaisa: 0,
      });
      expect(await accountBalance('LAB_ADVANCES')).toBe(0);
      const voided = ok(
        await admin('post', `/lab-payables/bills/${b.id}/void`, {
          version: (await bill(b.id)).version,
          reason: 'Wrong lab',
        }),
      );
      expect(voided.status).toBe('void');
      await assertLedgerBalanced();
      // Ledger rows are never deleted: the original journals are still there.
      const [{ n }] = await sqlRows<{ n: number }>(
        fx.dataSource,
        `SELECT count(*)::int AS n FROM ledger_journals WHERE source_id = $1 AND reversal_of_id IS NOT NULL`,
        [b.id],
      );
      expect(n).toBe(1);
    });

    it('a duplicate lab invoice number is refused', async () => {
      const order = await submitted([guard.id]);
      await accept(order.items[0].id);
      const [draft] = await billsOf(order.id);
      const dup = await admin(
        'post',
        `/lab-payables/bills/${draft.id}/approve`,
        {
          version: draft.version,
          vendorInvoiceNo: 'SMILE-1001',
        },
      );
      expect(code(dup)).toBe('PAYABLES_DUPLICATE_INVOICE');
    });
  });

  describe('remakes and extra charges', () => {
    /** Accept → start → finish → QC → dispatch → clinic receives. */
    const toReceived = async (itemId: string) => {
      await accept(itemId);
      for (const step of ['start', 'finish']) {
        ok(
          await portal(
            'post',
            `/lab-portal/production/items/${itemId}/${step}`,
            {},
          ),
        );
      }
      ok(
        await portal('post', `/lab-portal/production/items/${itemId}/qc`, {
          result: 'pass',
        }),
      );
      const shipment = ok(
        await portal('post', '/lab-portal/production/shipments', {
          courierName: 'TCS',
          lines: [{ itemId }],
        }),
        201,
      );
      const byToken = ok(
        await fx.clinic(
          'get',
          `/lab-shipments/by-token/${shipment.qrToken}`,
          A,
          A.doctor,
        ),
      );
      ok(
        await fx.clinic(
          'post',
          `/lab-shipments/${byToken.id}/receive`,
          A,
          A.doctor,
          {
            lines: byToken.lines.map((l: any) => ({
              shipmentItemId: l.id,
              receivedQty: l.quantity,
              condition: 'ok',
              qcResult: 'pass',
            })),
          },
        ),
      );
    };
    const remake = async (orderId: string, itemId: string, party: string) => {
      const rej = ok(
        await fx.clinic(
          'post',
          `/lab-orders/${orderId}/items/${itemId}/reject`,
          A,
          A.doctor,
          {
            reasonCode: 'fit',
            reason: 'Does not seat',
          },
        ),
      );
      const [r] = rej.remakeRequests;
      const agreed = ok(
        await fx.clinic(
          'post',
          `/lab-orders/${orderId}/remake-requests/${r.id}/decision`,
          A,
          A.doctor,
          {
            decision: 'agree',
            version: r.version,
            responsibleParty: party,
          },
        ),
      );
      return {
        remakeId: r.id as string,
        newItemId: agreed.items.find((i: any) => i.remakeOfItemId === itemId)
          .id as string,
      };
    };

    it("lab's fault: the remake costs 0 and opens no new bill (§15)", async () => {
      const order = await submitted([guard.id]);
      await toReceived(order.items[0].id);
      const [first] = await billsOf(order.id);
      await approve(first.id);
      const { newItemId } = await remake(order.id, order.items[0].id, 'lab');
      await accept(newItemId);
      const bills = await billsOf(order.id);
      expect(bills).toHaveLength(1);
      expect(bills[0]).toMatchObject({
        status: 'approved',
        totalPaisa: 200_000,
      });
    });

    it("lab's fault with the draft still open: a 0 remake line, total unchanged", async () => {
      const order = await submitted([guard.id]);
      await toReceived(order.items[0].id);
      const { newItemId, remakeId } = await remake(
        order.id,
        order.items[0].id,
        'lab',
      );
      await accept(newItemId);
      const [draft] = await billsOf(order.id);
      const full = await bill(draft.id);
      expect(full.totalPaisa).toBe(200_000);
      expect(
        full.lines.find((l: any) => l.lineKind === 'remake'),
      ).toMatchObject({
        orderItemId: newItemId,
        remakeRequestId: remakeId,
        lineTotalPaisa: 0,
      });
    });

    it("clinic's fault: the lab's charge lands on a new draft that needs approval", async () => {
      const order = await submitted([guard.id]);
      await toReceived(order.items[0].id);
      const [first] = await billsOf(order.id);
      await approve(first.id);
      const { newItemId } = await remake(order.id, order.items[0].id, 'clinic');
      await accept(newItemId);
      const bills = await billsOf(order.id);
      expect(bills.map((b: any) => [b.status, b.totalPaisa]).sort()).toEqual([
        ['approved', 200_000],
        ['draft', 200_000],
      ]);
      const draft = bills.find((b: any) => b.status === 'draft');
      expect((await bill(draft.id)).lines).toMatchObject([
        { lineKind: 'remake', lineTotalPaisa: 200_000 },
      ]);
    });

    it('an order-level charge approved later becomes a bill line on sync', async () => {
      const order = await submitted([guard.id]);
      await accept(order.items[0].id);
      const req = ok(
        await portal('post', `/lab-portal/orders/${order.id}/charge-requests`, {
          kind: 'shipping',
          amountPaisa: 30_000,
          reason: 'Courier to clinic',
        }),
        201,
      );
      const charge = req.charges[0];
      ok(
        await fx.clinic(
          'post',
          `/lab-orders/${order.id}/charge-requests/${charge.id}/decision`,
          A,
          A.doctor,
          {
            decision: 'approve',
            version: charge.version,
          },
        ),
        201,
      );
      const [draft] = await billsOf(order.id);
      // Approve re-syncs first: the stale version makes the accountant look again.
      const res = await admin(
        'post',
        `/lab-payables/bills/${draft.id}/approve`,
        { version: draft.version },
      );
      expect(code(res)).toBe('STALE_VERSION');
      const full = await bill(draft.id);
      expect(full.totalPaisa).toBe(230_000);
      expect(
        full.lines.find((l: any) => l.chargeRequestId === charge.id),
      ).toMatchObject({
        lineKind: 'shipping',
        lineTotalPaisa: 30_000,
      });
      expect((await approve(draft.id)).status).toBe('approved');
    });
  });

  describe('monthly statement reconciliation', () => {
    it('matched, amount mismatch, missing in system, missing in statement', async () => {
      const o1 = await submitted([guard.id]);
      const o2 = await submitted([guard.id]);
      const o3 = await submitted([guard.id]);
      for (const o of [o1, o2, o3]) await accept(o.items[0].id);
      const res = await admin('post', '/lab-payables/statements', {
        labId: lab.id,
        periodStart: addDays(today, -1),
        periodEnd: addDays(today, 1),
        statementRef: 'OCT-2026',
        lines: [
          { labReference: o1.orderNo, amountPaisa: 200_000 },
          { labReference: o2.orderNo, amountPaisa: 210_000 },
          { labReference: 'LAB-NOPE', amountPaisa: 5_000 },
        ],
      });
      const st = ok(res, 201);
      expect(st.status).toBe('reconciling');
      const byRef = (ref: string) =>
        st.lines.find((l: any) => l.labReference === ref);
      expect(byRef(o1.orderNo)).toMatchObject({
        matchStatus: 'matched',
        systemAmountPaisa: 200_000,
      });
      expect(byRef(o1.orderNo).matchedBillLineId).toBeTruthy();
      expect(byRef(o2.orderNo)).toMatchObject({
        matchStatus: 'amount_mismatch',
        systemAmountPaisa: 200_000,
      });
      expect(byRef('LAB-NOPE')).toMatchObject({
        matchStatus: 'missing_in_system',
      });
      const missing = st.lines.filter(
        (l: any) => l.matchStatus === 'missing_in_statement',
      );
      expect(missing.map((l: any) => l.orderNo)).toContain(o3.orderNo);
      const [o1Bill] = await billsOf(o1.id);
      expect(o1Bill.statementId).toBe(st.id);
      const closed = ok(
        await admin('post', `/lab-payables/statements/${st.id}/status`, {
          version: st.version,
          status: 'disputed',
          note: 'Asked the lab about LAB-NOPE',
        }),
      );
      expect(closed.status).toBe('disputed');
    });
  });

  describe('lab portal and reports', () => {
    it('the lab sees its approved bills, payments and statements — never clinic prices or drafts', async () => {
      const bills = ok(await portal('get', '/lab-portal/payables/bills'));
      expect(bills.data.length).toBeGreaterThan(0);
      expect(bills.data.every((b: any) => b.status !== 'draft')).toBe(true);
      const one = ok(
        await portal('get', `/lab-portal/payables/bills/${bills.data[0].id}`),
      );
      const payments = ok(await portal('get', '/lab-portal/payables/payments'));
      const statements = ok(
        await portal('get', '/lab-portal/payables/statements'),
      );
      const st = ok(
        await portal(
          'get',
          `/lab-portal/payables/statements/${statements.data[0].id}`,
        ),
      );
      const all = JSON.stringify([bills, one, payments, statements, st]);
      expect(all).not.toMatch(
        /patient[A-Za-z]*Price|clinicTreatmentId|journalId|"notes"/,
      );
      expect(one.clinicName).toBe('Labs IT A');
    });

    it("another lab sees none of this lab's bills", async () => {
      const bills = ok(
        await portal(
          'get',
          '/lab-portal/payables/bills',
          undefined,
          otherLabAdmin.id,
        ),
      );
      expect(bills.data).toEqual([]);
      const mine = ok(await portal('get', '/lab-portal/payables/bills'));
      const res = await portal(
        'get',
        `/lab-portal/payables/bills/${mine.data[0].id}`,
        undefined,
        otherLabAdmin.id,
      );
      expect(res.status).toBe(404);
    });

    it('aging and monthly lab cost', async () => {
      const aging = ok(await admin('get', '/lab-payables/reports/aging'));
      const row = aging.labs.find((l: any) => l.labId === lab.id);
      expect(row.totalPaisa).toBeGreaterThan(0);
      expect(row.buckets.current).toBe(row.totalPaisa);
      const monthly = ok(
        await admin(
          'get',
          `/lab-payables/reports/monthly-cost?year=${today.slice(0, 4)}`,
        ),
      );
      const m = monthly.labs.find((l: any) => l.labId === lab.id);
      expect(m.months[Number(today.slice(5, 7)) - 1]).toBe(m.totalPaisa);
      expect(m.totalPaisa).toBeGreaterThanOrEqual(1_000_000);
      expect(await assertLedgerBalanced()).toBeGreaterThan(0);
    });
  });
});
