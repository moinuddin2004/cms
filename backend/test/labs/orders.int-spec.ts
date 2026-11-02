/* Supertest bodies are untyped JSON; these suites assert on their shape. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import type { Response } from 'supertest';
import { IsNull } from 'typeorm';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { ServiceKind } from 'src/billing/enums/billing.enums';
import { addDays, localDate } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import { FormSchema } from 'src/engine/entities/form-schema.entity';
import { WorkflowTemplate } from 'src/engine/entities/workflow-template.entity';
import type { TransitionActor } from 'src/engine/runtime/runtime.types';
import { WorkflowEngine } from 'src/engine/runtime/workflow-engine.service';
import { ServiceCategory } from 'src/lab-catalog/entities/service-category.entity';
import { LabCatalogModule } from 'src/lab-catalog/lab-catalog.module';
import type { AttachmentStorage } from 'src/lab-orders/attachments/attachment-storage';
import { AttachmentsService } from 'src/lab-orders/attachments/attachments.service';
import { OrderException } from 'src/lab-orders/common/order-errors';
import { LabOrderItem } from 'src/lab-orders/entities/lab-order-item.entity';
import { LabOrdersModule } from 'src/lab-orders/lab-orders.module';
import { Patient } from 'src/patients/entities/patient.entity';
import { Clinic, LabsFixture, createLabsFixture } from './labs-it.harness';

const code = (res: Response): string | undefined =>
  (res.body?.error?.code ?? res.body?.code) as string | undefined;

/**
 * Sprint 6 — order creation (lab ERD §5a, §10, §14 steps 2–5, §19
 * acceptance): drafts, submit in one transaction, snapshots, revisions,
 * messages, charges, attachments and the lab's view.
 */
describe('Lab orders (API)', () => {
  let fx: LabsFixture;
  let A: Clinic;
  let B: Clinic;
  let engine: WorkflowEngine;
  let lab: { id: string };
  let labAdmin: { id: string; email: string };
  let service: { id: string };
  let caseService: { id: string };
  let priceId: string;
  let patientId: string;
  let doctorEmployeeId: string;
  const today = localDate('Asia/Karachi', new Date());

  const crown = (
    teeth = ['11', '21'],
    extra: Record<string, unknown> = {},
  ) => ({
    teeth: teeth.map((tooth) => ({ tooth })),
    material: 'zirconia_monolithic',
    shade_system: 'VITA_classical',
    shade: 'A2',
    impression_type: 'physical',
    ...extra,
  });

  const portal = (method: 'get' | 'post', url: string, body?: object) =>
    request(fx.app.getHttpServer())
      [method](url)
      .set('x-test-user', labAdmin.id)
      .send(body);

  const draft = async (
    items: object[] = [{ labServiceId: service.id, answers: crown() }],
    key?: string,
    clinic: Clinic = A,
  ) => {
    let req = request(fx.app.getHttpServer())
      .post('/lab-orders')
      .set('x-test-user', clinic.doctor)
      .set('x-organization-id', clinic.organizationId)
      .set('x-location-id', clinic.locationId);
    if (key) req = req.set('idempotency-key', key);
    return req.send({ patientId, labId: lab.id, items });
  };

  const submit = (
    id: string,
    version: number,
    key: string | null = randomUUID(),
  ) => {
    let req = request(fx.app.getHttpServer())
      .post(`/lab-orders/${id}/submit`)
      .set('x-test-user', A.doctor)
      .set('x-organization-id', A.organizationId)
      .set('x-location-id', A.locationId);
    if (key) req = req.set('idempotency-key', key);
    return req.send({ version });
  };

  const submitted = async (items?: object[]) => {
    const d = await draft(items);
    expect(d.status).toBe(201);
    const s = await submit(d.body.data.id, d.body.data.version);
    expect(s.status).toBe(201);
    return s.body.data;
  };

  const get = (id: string, clinic: Clinic = A) =>
    fx.clinic('get', `/lab-orders/${id}`, clinic, clinic.doctor);

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_order_api', [
      LabCatalogModule,
      LabOrdersModule,
    ]);
    A = fx.clinicA;
    B = fx.clinicB;
    engine = fx.app.get(WorkflowEngine);
    const m = fx.dataSource.manager;
    const platformDef = { organizationId: IsNull() };
    const crownForm = await m
      .getRepository(FormSchema)
      .findOneByOrFail({ ...platformDef, code: 'CROWN' });
    const itemWorkflow = await m
      .getRepository(WorkflowTemplate)
      .findOneByOrFail({ ...platformDef, code: 'DENTAL_ITEM' });
    const category = await m
      .getRepository(ServiceCategory)
      .findOneByOrFail({ code: 'CROWN' });

    const created = await fx.platform('post', '/platform/labs', fx.superAdmin, {
      name: `Orders IT Lab ${randomUUID().slice(0, 6)}`,
      labType: 'external',
      city: 'Lahore',
    });
    lab = created.body.data;
    labAdmin = await fx.newUser('lab-admin');
    await fx.platform(
      'post',
      `/platform/labs/${lab.id}/members`,
      fx.superAdmin,
      {
        email: labAdmin.email,
        role: 'lab_admin',
      },
    );

    const svc = await fx.platform(
      'post',
      `/platform/labs/${lab.id}/services`,
      fx.superAdmin,
      {
        categoryId: category.id,
        code: 'zr_crown',
        name: 'Zirconia crown',
        unitType: 'per_tooth',
        defaultTurnaroundDays: 5,
        formSchemaId: crownForm.id,
        workflowTemplateId: itemWorkflow.id,
      },
    );
    expect(svc.status).toBe(201);
    service = svc.body.data;
    const svc2 = await fx.platform(
      'post',
      `/platform/labs/${lab.id}/services`,
      fx.superAdmin,
      {
        categoryId: category.id,
        code: 'night_guard',
        name: 'Night guard',
        unitType: 'per_case',
        defaultTurnaroundDays: 3,
      },
    );
    caseService = svc2.body.data;
    for (const [id, minor] of [
      [service.id, 500_000],
      [caseService.id, 200_000],
    ] as const) {
      const p = await fx.platform(
        'post',
        `/platform/labs/${lab.id}/services/${id}/prices`,
        fx.superAdmin,
        {
          unitPriceMinor: minor,
          effectiveFrom: today,
        },
      );
      expect(p.status).toBe(201);
      if (id === service.id) priceId = p.body.data.id;
    }

    for (const clinic of [A, B]) {
      const link = await fx.clinic('post', '/lab-links', clinic, clinic.admin, {
        labId: lab.id,
      });
      await fx.clinic(
        'post',
        `/lab-links/${link.body.data.id}/transitions`,
        clinic,
        clinic.admin,
        {
          action: 'activate',
          version: 1,
        },
      );
    }

    // A's patient price list: both services mapped to treatments.
    for (const [labServiceId, price, name] of [
      [service.id, 15_000, 'Zirconia crown'],
      [caseService.id, 6_000, 'Night guard'],
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
      fullName: 'Ali Raza',
      phone: '03001234567',
    } as Partial<Patient>);
    patientId = patient.id;
    [{ employee_id: doctorEmployeeId }] = await sqlRows<{
      employee_id: string;
    }>(
      fx.dataSource,
      `SELECT employee_id FROM employee_org_location_assignments WHERE user_id = $1`,
      [A.doctor],
    );

    const fake: AttachmentStorage = {
      put: (key) => Promise.resolve(key),
      signedUrl: (key, ttl) => `https://files.test/${key}?ttl=${ttl}&sig=x`,
    };
    // Swap the private storage for a fake (no Cloudinary in tests).
    (
      fx.app.get(AttachmentsService) as unknown as {
        storage: AttachmentStorage;
      }
    ).storage = fake;
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  describe('drafts', () => {
    it('a doctor saves a draft without validation; the same Idempotency-Key gives the same draft', async () => {
      const key = randomUUID();
      const res = await draft(
        [{ labServiceId: service.id, answers: { material: 'emax' } }],
        key,
      );
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        orderNo: null,
        status: 'draft',
        totals: null,
        doctor: { id: doctorEmployeeId },
        lab: { id: lab.id },
        items: [
          {
            lineNo: 1,
            status: null,
            prices: null,
            answers: { material: 'emax' },
            form: { code: 'CROWN' },
          },
        ],
      });
      expect(res.body.data.availableActions).toEqual(
        expect.arrayContaining(['cancel']),
      );
      const again = await draft([{ labServiceId: service.id }], key);
      expect(again.body.data.id).toBe(res.body.data.id);
    });

    it('edits lines with optimistic locking; only drafts can be edited', async () => {
      const d = (await draft()).body.data;
      const res = await fx.clinic('patch', `/lab-orders/${d.id}`, A, A.doctor, {
        version: d.version,
        notes: 'Rush please',
        items: [
          {
            id: d.items[0].id,
            labServiceId: service.id,
            answers: crown(['11']),
          },
          { labServiceId: caseService.id },
        ],
      });
      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe('Rush please');
      expect(res.body.data.items.map((i: { id: string }) => i.id)[0]).toBe(
        d.items[0].id,
      );
      expect(res.body.data.items).toHaveLength(2);
      const stale = await fx.clinic(
        'patch',
        `/lab-orders/${d.id}`,
        A,
        A.doctor,
        { version: d.version, notes: 'x' },
      );
      expect(code(stale)).toBe('STALE_VERSION');
    });

    it('refuses another lab’s service and another clinic’s patient', async () => {
      const other = await fx.platform('post', '/platform/labs', fx.superAdmin, {
        name: `Other ${randomUUID().slice(0, 6)}`,
        labType: 'external',
        city: 'Karachi',
      });
      const res = await fx.clinic('post', '/lab-orders', A, A.doctor, {
        patientId,
        labId: other.body.data.id,
        items: [{ labServiceId: service.id }],
      });
      expect(res.status).toBe(404);
      const cross = await draft(undefined, undefined, B);
      expect(code(cross)).toBe('LAB_ORDER_PATIENT_NOT_FOUND');
    });
  });

  describe('submit', () => {
    it('needs an Idempotency-Key; invalid answers block it and burn no order number', async () => {
      const d = (
        await draft([
          { labServiceId: service.id, answers: { material: 'emax' } },
        ])
      ).body.data;
      expect(code(await submit(d.id, d.version, null))).toBe(
        'IDEMPOTENCY_KEY_REQUIRED',
      );
      const bad = await submit(d.id, d.version);
      expect(bad.status).toBe(422);
      expect(code(bad)).toBe('LAB_ORDER_INVALID');
      expect((bad.body.error ?? bad.body).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ line: 1, path: 'teeth', code: 'required' }),
        ]),
      );
      const after = (await get(d.id)).body.data;
      expect(after).toMatchObject({ status: 'draft', orderNo: null });
      const [seq] = await sqlRows<{ n: string }>(
        fx.dataSource,
        `SELECT count(*) AS n FROM number_sequences WHERE organization_id = $1`,
        [A.organizationId],
      );
      expect(Number(seq.n)).toBe(0);
    });

    it('freezes prices, validates answers, writes teeth, promotions, revision 1 and the outbox in one go', async () => {
      const d = (await draft()).body.data;
      const key = randomUUID();
      const res = await submit(d.id, d.version, key);
      expect(res.status).toBe(201);
      const o = res.body.data;
      expect(o).toMatchObject({
        orderNo: 'LAB-0001',
        status: 'submitted',
        currentRevisionNo: 1,
        labExpectedOn: addDays(today, 5),
        replayed: false,
        totals: { labCostMinor: 1_000_000, patientPriceMinor: 3_000_000 },
        items: [
          {
            status: 'pending_acceptance',
            quantity: 2,
            serviceCode: 'ZR_CROWN',
            prices: {
              labUnitCostMinor: 500_000,
              labLineCostMinor: 1_000_000,
              patientUnitPriceMinor: 1_500_000,
              patientLinePriceMinor: 3_000_000,
              pricedOn: today,
            },
            teeth: [
              { tooth: '11', role: 'crown', dentition: 'permanent' },
              { tooth: '21', role: 'crown', dentition: 'permanent' },
            ],
            details: {
              shadeSystem: 'VITA_classical',
              shade: 'A2',
              materialCode: 'zirconia_monolithic',
            },
          },
        ],
        revisions: [{ revisionNo: 1, labAcknowledgedAt: null }],
      });
      expect(o.items[0].validatedAt).not.toBeNull();
      expect(o.history.map((h: { toState: string }) => h.toState)).toContain(
        'submitted',
      );

      const outbox = await sqlRows<{ audience: string; recipient_id: string }>(
        fx.dataSource,
        `SELECT audience, recipient_id FROM notification_outbox WHERE entity_id = $1 AND event_code = 'order.submitted'`,
        [d.id],
      );
      expect(outbox.length).toBeGreaterThan(0);
      expect(
        outbox.every(
          (r) => r.audience === 'lab' && r.recipient_id === labAdmin.id,
        ),
      ).toBe(true);

      // Acceptance: the same key twice → one order.
      const again = await submit(d.id, d.version, key);
      expect(again.status).toBe(201);
      expect(again.body.data).toMatchObject({
        orderNo: 'LAB-0001',
        replayed: true,
      });
      const [{ n }] = await sqlRows<{ n: string }>(
        fx.dataSource,
        `SELECT count(*) AS n FROM order_revisions WHERE order_id = $1`,
        [d.id],
      );
      expect(Number(n)).toBe(1);
      const next = await submitted();
      expect(next.orderNo).toBe('LAB-0002');
    });

    it('acceptance: an invalid transition answers 422', async () => {
      const d = (await draft()).body.data;
      const res = await fx.clinic(
        'post',
        `/lab-orders/${d.id}/transitions`,
        A,
        A.doctor,
        {
          action: 'receive',
          version: d.version,
        },
      );
      expect(res.status).toBe(422);
      expect(code(res)).toBe('INVALID_TRANSITION');
      const o = await submitted();
      expect(code(await submit(o.id, o.version))).toBe('INVALID_TRANSITION');
    });

    it('acceptance: a catalog price change leaves submitted orders unchanged', async () => {
      const o = await submitted([
        { labServiceId: service.id, answers: crown(['16']) },
      ]);
      expect(o.items[0].prices.labUnitCostMinor).toBe(500_000);
      await fx.dataSource.query(
        `UPDATE lab_service_prices SET unit_price_minor = 900000 WHERE id = $1`,
        [priceId],
      );
      try {
        const reread = (await get(o.id)).body.data;
        expect(reread.items[0].prices).toMatchObject({
          labUnitCostMinor: 500_000,
          labLineCostMinor: 500_000,
        });
        expect(reread.revisions[0].snapshot.items[0].labUnitCostMinor).toBe(
          500_000,
        );
        const fresh = await submitted([
          { labServiceId: service.id, answers: crown(['16']) },
        ]);
        expect(fresh.items[0].prices.labUnitCostMinor).toBe(900_000);
      } finally {
        await fx.dataSource.query(
          `UPDATE lab_service_prices SET unit_price_minor = 500000 WHERE id = $1`,
          [priceId],
        );
      }
    });

    it('a submitted line’s snapshot can’t be changed directly (inv. 3)', async () => {
      const o = await submitted();
      const repo = fx.dataSource.getRepository(LabOrderItem);
      const item = await repo.findOneByOrFail({ id: o.items[0].id });
      item.labUnitCostMinor = 1;
      await expect(repo.save(item)).rejects.toBeInstanceOf(OrderException);
      item.labUnitCostMinor = 500_000;
      item.currentStageSeq = 1;
      await expect(repo.save(item)).resolves.toBeDefined();
    });

    it('warns when the work is due after the patient’s next appointment', async () => {
      await fx.dataSource.getRepository(Appointment).save({
        organizationId: A.organizationId,
        locationId: A.locationId,
        patientId,
        doctorId: doctorEmployeeId,
        startTime: new Date(Date.now() + 2 * 86_400_000),
        endTime: new Date(Date.now() + 2 * 86_400_000 + 1_800_000),
      } as Partial<Appointment>);
      const o = await submitted();
      expect(o.warnings).toEqual([
        expect.objectContaining({
          code: 'LAB_DUE_AFTER_NEXT_APPOINTMENT',
          labExpectedOn: addDays(today, 5),
        }),
      ]);
    });
  });

  describe('order status (§9c derivation)', () => {
    it('acceptance: one item ready while another is in production → partially_ready', async () => {
      const o = await submitted([
        { labServiceId: service.id, answers: crown(['11']) },
        { labServiceId: caseService.id },
      ]);
      const labActor: TransitionActor = {
        userId: labAdmin.id,
        side: 'lab',
        roles: ['lab_admin'],
      };
      const item = (
        id: string,
        action: string,
        input?: Record<string, unknown>,
      ) =>
        engine.transition({
          organizationId: A.organizationId,
          entityType: 'item',
          entityId: id,
          action,
          actor: labActor,
          input,
        });
      const [i1, i2] = o.items.map((i: { id: string }) => i.id);
      for (const id of [i1, i2])
        await item(id, 'accept', { lab_expected_on: addDays(today, 4) });
      expect((await get(o.id)).body.data.status).toBe('accepted');
      for (const id of [i1, i2]) await item(id, 'start');
      expect((await get(o.id)).body.data.status).toBe('in_progress');
      await item(i1, 'finish');
      await item(i1, 'qc_pass');
      const after = (await get(o.id)).body.data;
      expect(after.status).toBe('partially_ready');
      expect(after.items.map((i: { status: string }) => i.status)).toEqual([
        'ready',
        'in_production',
      ]);
      expect(after.acceptedAt).not.toBeNull();
    });
  });

  describe('lab side, messages, revisions, charges, files', () => {
    let order: { id: string; version: number; items: { id: string }[] };

    beforeAll(async () => {
      order = await submitted();
    });

    it('the lab sees its orders without patient prices or drafts; other clinics see nothing', async () => {
      const list = await portal('get', '/lab-portal/orders');
      expect(list.status).toBe(200);
      expect(
        list.body.data.data.every(
          (r: { status: string }) => r.status !== 'draft',
        ),
      ).toBe(true);
      const res = await portal('get', `/lab-portal/orders/${order.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        patient: { ref: 'Ali Raza' },
        items: [{ labUnitCostMinor: 500_000 }],
      });
      const json = JSON.stringify(res.body.data);
      expect(json).not.toMatch(
        /patientUnitPrice|patientLinePrice|patientPrice|clinicTreatmentId/,
      );
      expect((await get(order.id, B)).status).toBe(404);
    });

    it('the clinic list filters by status and patient and stays in its tenant', async () => {
      const res = await fx.clinic(
        'get',
        `/lab-orders?status=submitted&patientId=${patientId}&search=LAB-`,
        A,
        A.doctor,
      );
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBeGreaterThan(0);
      expect(
        res.body.data.data.every(
          (r: { status: string; labCostMinor: number }) =>
            r.status === 'submitted' && r.labCostMinor > 0,
        ),
      ).toBe(true);
      const drafts = await fx.clinic(
        'get',
        '/lab-orders?status=draft',
        A,
        A.doctor,
      );
      expect(drafts.body.data.data[0]).toMatchObject({
        orderNo: null,
        labCostMinor: null,
      });
      const other = await fx.clinic('get', '/lab-orders', B, B.doctor);
      expect(other.body.data.total).toBe(0);
    });

    it('lab clarification → clarification_needed; clinic reply → submitted', async () => {
      const ask = await portal(
        'post',
        `/lab-portal/orders/${order.id}/messages`,
        {
          kind: 'clarification_request',
          body: 'Which shade for 21?',
        },
      );
      expect(ask.status).toBe(201);
      expect(ask.body.data.status).toBe('clarification_needed');
      const reply = await fx.clinic(
        'post',
        `/lab-orders/${order.id}/messages`,
        A,
        A.doctor,
        {
          kind: 'reply',
          body: 'A2 for both',
        },
      );
      expect(reply.status).toBe(201);
      expect(reply.body.data.status).toBe('submitted');
      expect(reply.body.data.messages).toEqual([
        expect.objectContaining({
          kind: 'clarification_request',
          authorSide: 'lab',
          resolvedAt: expect.any(String),
        }),
        expect.objectContaining({ kind: 'reply', authorSide: 'clinic' }),
      ]);
      const notAgain = await fx.clinic(
        'post',
        `/lab-orders/${order.id}/messages`,
        A,
        A.doctor,
        {
          kind: 'reply',
          body: 'again',
        },
      );
      expect(code(notAgain)).toBe('LAB_ORDER_MESSAGE_INVALID');
    });

    it('a revision is a new version, re-validated; the lab acknowledges it', async () => {
      const cur = (await get(order.id)).body.data;
      const bad = await fx.clinic(
        'post',
        `/lab-orders/${order.id}/revisions`,
        A,
        A.doctor,
        {
          version: cur.version,
          reason: 'Shade',
          items: [{ itemId: cur.items[0].id, answers: { material: 'emax' } }],
        },
      );
      expect(code(bad)).toBe('LAB_ORDER_INVALID');
      const res = await fx.clinic(
        'post',
        `/lab-orders/${order.id}/revisions`,
        A,
        A.doctor,
        {
          version: cur.version,
          reason: 'Shade changed',
          items: [
            {
              itemId: cur.items[0].id,
              answers: crown(['11', '21', '22'], { shade: 'B1' }),
            },
          ],
        },
      );
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        currentRevisionNo: 2,
        items: [
          {
            quantity: 3,
            details: { shade: 'B1' },
            prices: { labLineCostMinor: 1_500_000 },
          },
        ],
      });
      expect(
        res.body.data.revisions.map(
          (r: { revisionNo: number }) => r.revisionNo,
        ),
      ).toEqual([1, 2]);
      expect(res.body.data.revisions[0].snapshot.items[0].quantity).toBe(2);
      const ack = await portal(
        'post',
        `/lab-portal/orders/${order.id}/revisions/2/acknowledge`,
      );
      expect(ack.status).toBe(201);
      expect(ack.body.data.revisions[1].labAcknowledgedAt).not.toBeNull();
    });

    it('the lab requests a charge; an approved item charge raises that line’s lab cost', async () => {
      const res = await portal(
        'post',
        `/lab-portal/orders/${order.id}/charge-requests`,
        {
          kind: 'material',
          amountMinor: 50_000,
          reason: 'Extra layering',
          itemId: order.items[0].id,
        },
      );
      expect(res.status).toBe(201);
      const charge = res.body.data.charges[0];
      expect(charge).toMatchObject({ status: 'pending', amountMinor: 50_000 });
      const ok = await fx.clinic(
        'post',
        `/lab-orders/${order.id}/charge-requests/${charge.id}/decision`,
        A,
        A.doctor,
        { decision: 'approve', version: charge.version },
      );
      expect(ok.status).toBe(201);
      expect(ok.body.data.charges[0].status).toBe('approved');
      expect(ok.body.data.items[0].prices.labLineCostMinor).toBe(1_550_000);
      const twice = await fx.clinic(
        'post',
        `/lab-orders/${order.id}/charge-requests/${charge.id}/decision`,
        A,
        A.doctor,
        { decision: 'reject', version: ok.body.data.charges[0].version },
      );
      expect(code(twice)).toBe('LAB_ORDER_CHARGE_DECIDED');
    });

    it('files: hashed, signed URLs only, the lab sees lab-shared files only', async () => {
      const upload = (visibility: string) =>
        request(fx.app.getHttpServer())
          .post(`/lab-orders/${order.id}/attachments`)
          .set('x-test-user', A.doctor)
          .set('x-organization-id', A.organizationId)
          .set('x-location-id', A.locationId)
          .field('visibility', visibility)
          .attach('file', Buffer.from(`scan ${visibility}`), 'scan.stl');
      const internal = await upload('internal');
      const shared = await upload('lab_shared');
      expect(internal.status).toBe(201);
      expect(shared.body.data.sha256).toMatch(/^[0-9a-f]{64}$/);
      const url = await fx.clinic(
        'get',
        `/lab-orders/${order.id}/attachments/${internal.body.data.id}/url`,
        A,
        A.doctor,
      );
      expect(url.body.data.url).toContain(
        `org/${A.organizationId}/lab_order/${order.id}/`,
      );
      const labView = (await portal('get', `/lab-portal/orders/${order.id}`))
        .body.data;
      expect(labView.attachments.map((a: { id: string }) => a.id)).toEqual([
        shared.body.data.id,
      ]);
      expect(
        (
          await portal(
            'get',
            `/lab-portal/orders/${order.id}/attachments/${internal.body.data.id}/url`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await portal(
            'get',
            `/lab-portal/orders/${order.id}/attachments/${shared.body.data.id}/url`,
          )
        ).status,
      ).toBe(200);
    });

    it('prints a work order with a QR and no prices', async () => {
      const res = await fx.clinic(
        'get',
        `/lab-orders/${order.id}/work-order`,
        A,
        A.doctor,
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        qrValue: expect.stringContaining(`/o/${order.id}`),
        patient: { ref: 'Ali Raza' },
        items: [{ serviceName: 'Zirconia crown', teeth: expect.any(Array) }],
      });
      expect(res.body.data.items[0].answers).toEqual(
        expect.arrayContaining([{ label: 'Shade', value: 'B1' }]),
      );
      expect(JSON.stringify(res.body.data)).not.toMatch(/Minor/);
    });
  });

  describe('speed: repeat and templates', () => {
    it('repeats an order as a new draft, keeping answers', async () => {
      const o = await submitted();
      const res = await fx.clinic(
        'post',
        `/lab-orders/${o.id}/repeat`,
        A,
        A.doctor,
        {},
      );
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        status: 'draft',
        items: [
          {
            labServiceId: service.id,
            answers: { shade: 'A2', teeth: [{ tooth: '11' }, { tooth: '21' }] },
          },
        ],
      });
      expect(res.body.data.id).not.toBe(o.id);
    });

    it('starts a draft from an order template and counts the use at submit', async () => {
      const t = await fx.clinic(
        'post',
        '/lab-catalog/order-templates',
        A,
        A.doctor,
        {
          name: 'Crown',
          items: [{ labServiceId: service.id, answers: { material: 'emax' } }],
        },
      );
      expect(t.status).toBe(201);
      const d = await fx.clinic(
        'post',
        '/lab-orders/from-template',
        A,
        A.doctor,
        {
          templateId: t.body.data.id,
          patientId,
        },
      );
      expect(d.status).toBe(201);
      expect(d.body.data).toMatchObject({
        orderTemplateId: t.body.data.id,
        items: [{ answers: { material: 'emax' } }],
      });
      await fx.clinic('patch', `/lab-orders/${d.body.data.id}`, A, A.doctor, {
        version: d.body.data.version,
        items: [
          {
            id: d.body.data.items[0].id,
            labServiceId: service.id,
            answers: crown(),
          },
        ],
      });
      const cur = (await get(d.body.data.id)).body.data;
      expect((await submit(cur.id, cur.version)).status).toBe(201);
      const tpl = await fx.clinic(
        'get',
        `/lab-catalog/order-templates/${t.body.data.id}`,
        A,
        A.doctor,
      );
      expect(tpl.body.data.useCount).toBe(1);
    });
  });
});
