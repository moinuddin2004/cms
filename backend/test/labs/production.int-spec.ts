/* Supertest bodies are untyped JSON; these suites assert on their shape. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import type { Response } from 'supertest';
import { IsNull } from 'typeorm';
import { CatalogService } from 'src/billing/entities/catalog-service.entity';
import { ServiceKind } from 'src/billing/enums/billing.enums';
import { addDays, localDate } from 'src/common/clock/tz.util';
import { sqlRows } from 'src/common/database/sql';
import { StageTemplate } from 'src/engine/entities/stage-template.entity';
import type { TransitionActor } from 'src/engine/runtime/runtime.types';
import { WorkflowEngine } from 'src/engine/runtime/workflow-engine.service';
import { ServiceCategory } from 'src/lab-catalog/entities/service-category.entity';
import { LabCatalogModule } from 'src/lab-catalog/lab-catalog.module';
import { LabOrdersModule } from 'src/lab-orders/lab-orders.module';
import { LabProductionModule } from 'src/lab-production/lab-production.module';
import { warrantyEndsOn } from 'src/lab-production/workflow/production-workflow.service';
import { Patient } from 'src/patients/entities/patient.entity';
import { Clinic, LabsFixture, createLabsFixture } from './labs-it.harness';

const code = (res: Response): string | undefined =>
  (res.body?.error?.code ?? res.body?.code) as string | undefined;

interface Stage {
  id: string;
  seq: number;
  roundNo: number;
  status: string;
  isActive: boolean;
  outcome: string | null;
  correctionNotes: string | null;
  isFinal: boolean;
}

/**
 * Sprint 8 — production (lab ERD §5b, §9a/§9b, §10 shipment receive +
 * remake decision, inv. 8 + 9, §14 steps 6–8 and exceptions, §19
 * acceptance): stages and the try-in loop, QC, shipments both ways with
 * partial receiving and lost parcels, remakes and warranties.
 */
describe('Lab production (API)', () => {
  let fx: LabsFixture;
  let A: Clinic;
  let engine: WorkflowEngine;
  let lab: { id: string };
  let labAdmin: { id: string; email: string };
  let technician: { id: string; email: string };
  let otherLabAdmin: { id: string; email: string };
  let pfm: { id: string };
  let plain: { id: string };
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

  const clinic = (method: 'get' | 'post', url: string, body?: object) =>
    fx.clinic(method, url, A, A.doctor, body);

  const submitted = async (services: string[]) => {
    const d = await clinic('post', '/lab-orders', {
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
      items: { id: string; prices: Record<string, number> }[];
    };
  };

  /** Sprint 7 owns the accept endpoint; here the engine is called directly. */
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

  const production = async (orderId: string) => {
    const res = await clinic('get', `/lab-orders/${orderId}/production`);
    expect(res.status).toBe(200);
    return res.body.data;
  };
  const orderStatus = async (orderId: string) =>
    (await clinic('get', `/lab-orders/${orderId}`)).body.data.status as string;
  const itemStatus = async (itemId: string) =>
    (
      await sqlRows<{ status_code: string }>(
        fx.dataSource,
        `SELECT status_code FROM lab_order_items WHERE id = $1`,
        [itemId],
      )
    )[0].status_code;

  const ok = (res: Response, status = 200) => {
    if (res.status !== status) throw new Error(JSON.stringify(res.body));
    return res.body.data;
  };

  const dispatch = async (itemIds: string[]) =>
    ok(
      await portal('post', '/lab-portal/production/shipments', {
        courierName: 'TCS',
        lines: itemIds.map((itemId) => ({ itemId })),
      }),
      201,
    );

  /** The clinic receives every open line (via the slip's QR token). */
  const receiveAll = async (shipment: {
    qrToken: string;
    lines: { id: string; quantity: number; condition: string | null }[];
  }) => {
    const byToken = ok(
      await clinic('get', `/lab-shipments/by-token/${shipment.qrToken}`),
    );
    return ok(
      await clinic('post', `/lab-shipments/${byToken.id}/receive`, {
        viaQr: true,
        lines: byToken.lines
          .filter((l: { condition: string | null }) => !l.condition)
          .map((l: { id: string; quantity: number }) => ({
            shipmentItemId: l.id,
            receivedQty: l.quantity,
            condition: 'ok',
            qcResult: 'pass',
          })),
      }),
    );
  };

  const stagesOf = async (orderId: string, itemId: string): Promise<Stage[]> =>
    (await production(orderId)).items.find(
      (i: { id: string }) => i.id === itemId,
    ).stages;

  /** A no-stage item from accept to clinic-received. */
  const toReceived = async (itemId: string) => {
    await accept(itemId);
    ok(
      await portal('post', `/lab-portal/production/items/${itemId}/start`, {}),
    );
    ok(
      await portal('post', `/lab-portal/production/items/${itemId}/finish`, {}),
    );
    ok(
      await portal('post', `/lab-portal/production/items/${itemId}/qc`, {
        result: 'pass',
      }),
    );
    await receiveAll(await dispatch([itemId]));
  };

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_production_api', [
      LabCatalogModule,
      LabOrdersModule,
      LabProductionModule,
    ]);
    A = fx.clinicA;
    engine = fx.app.get(WorkflowEngine);
    const m = fx.dataSource.manager;
    const category = await m
      .getRepository(ServiceCategory)
      .findOneByOrFail({ code: 'CROWN' });
    const pfm3 = await m
      .getRepository(StageTemplate)
      .findOneByOrFail({ code: 'PFM_3_STAGE', organizationId: IsNull() });

    const created = await fx.platform('post', '/platform/labs', fx.superAdmin, {
      name: `Production IT Lab ${randomUUID().slice(0, 6)}`,
      labType: 'external',
      city: 'Lahore',
    });
    lab = created.body.data;
    labAdmin = await fx.newUser('prod-lab-admin');
    technician = await fx.newUser('prod-tech');
    for (const [user, role] of [
      [labAdmin, 'lab_admin'],
      [technician, 'lab_technician'],
    ] as const) {
      const r = await fx.platform(
        'post',
        `/platform/labs/${lab.id}/members`,
        fx.superAdmin,
        { email: user.email, role },
      );
      expect(r.status).toBe(201);
    }
    const other = await fx.platform('post', '/platform/labs', fx.superAdmin, {
      name: `Other Production Lab ${randomUUID().slice(0, 6)}`,
      labType: 'external',
      city: 'Karachi',
    });
    otherLabAdmin = await fx.newUser('other-lab-admin');
    await fx.platform(
      'post',
      `/platform/labs/${other.body.data.id}/members`,
      fx.superAdmin,
      { email: otherLabAdmin.email, role: 'lab_admin' },
    );

    const service = async (
      code: string,
      name: string,
      minor: number,
      stageTemplateId: string | null,
    ) => {
      const s = await fx.platform(
        'post',
        `/platform/labs/${lab.id}/services`,
        fx.superAdmin,
        {
          categoryId: category.id,
          code,
          name,
          unitType: 'per_case',
          defaultTurnaroundDays: 5,
          stageTemplateId,
        },
      );
      expect(s.status).toBe(201);
      const p = await fx.platform(
        'post',
        `/platform/labs/${lab.id}/services/${s.body.data.id}/prices`,
        fx.superAdmin,
        { unitPriceMinor: minor, effectiveFrom: today },
      );
      expect(p.status).toBe(201);
      return s.body.data as { id: string };
    };
    pfm = await service('pfm_bridge', 'PFM bridge', 800_000, pfm3.id);
    plain = await service('night_guard', 'Night guard', 200_000, null);

    const link = await fx.clinic('post', '/lab-links', A, A.admin, {
      labId: lab.id,
    });
    await fx.clinic(
      'post',
      `/lab-links/${link.body.data.id}/transitions`,
      A,
      A.admin,
      { action: 'activate', version: 1 },
    );
    for (const [labServiceId, price, name] of [
      [pfm.id, 25_000, 'PFM bridge'],
      [plain.id, 6_000, 'Night guard'],
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
      fullName: 'Sana Iqbal',
      phone: '03001234500',
    } as Partial<Patient>);
    patientId = patient.id;
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  describe('stages and the try-in loop', () => {
    let orderId: string;
    let itemId: string;

    beforeAll(async () => {
      const o = await submitted([pfm.id]);
      orderId = o.id;
      itemId = o.items[0].id;
    });

    it('init_stages: lab accept creates round-1 rows from the stage template, none active', async () => {
      await accept(itemId);
      const stages = await stagesOf(orderId, itemId);
      expect(
        stages.map((s) => [s.seq, s.roundNo, s.status, s.isActive]),
      ).toEqual([
        [1, 1, 'pending', false],
        [2, 1, 'pending', false],
        [3, 1, 'pending', false],
      ]);
      expect(stages.map((s) => s.isFinal)).toEqual([false, false, true]);
    });

    it('start work starts stage 1; finishing before the final stage is refused', async () => {
      ok(
        await portal(
          'post',
          `/lab-portal/production/items/${itemId}/start`,
          {},
        ),
      );
      const stages = await stagesOf(orderId, itemId);
      expect(stages[0]).toMatchObject({ status: 'at_lab', isActive: true });
      expect(await orderStatus(orderId)).toBe('in_progress');
      const early = await portal(
        'post',
        `/lab-portal/production/items/${itemId}/finish`,
        {},
      );
      expect(code(early)).toBe('PRODUCTION_NOT_ALLOWED');
    });

    it('invariant 9: the database refuses a second active stage on one item', async () => {
      const stages = await stagesOf(orderId, itemId);
      await expect(
        fx.dataSource.query(
          `UPDATE order_item_stages SET is_active = true WHERE id = $1`,
          [stages[1].id],
        ),
      ).rejects.toThrow(/uq_order_item_stages_one_active|duplicate key/);
    });

    it('acceptance: a try-in correction creates round_no = 2 for the same stage, round 1 preserved', async () => {
      const shipment = await dispatch([itemId]);
      expect(shipment).toMatchObject({
        direction: 'to_clinic',
        status: 'dispatched',
        lines: [{ contents: 'tryin', stageName: 'Metal try-in' }],
      });
      expect(await itemStatus(itemId)).toBe('at_clinic_tryin');

      await receiveAll(shipment);
      let [metal] = await stagesOf(orderId, itemId);
      expect(metal.status).toBe('received');
      const [via] = await sqlRows<{ via: string }>(
        fx.dataSource,
        `SELECT via FROM status_history WHERE entity_type = 'stage' AND entity_id = $1 AND to_state = 'received'`,
        [metal.id],
      );
      expect(via.via).toBe('qr');

      ok(
        await clinic(
          'post',
          `/lab-orders/${orderId}/stages/${metal.id}/tryin`,
          { notes: 'Tried in' },
        ),
      );
      const noNotes = await clinic(
        'post',
        `/lab-orders/${orderId}/stages/${metal.id}/decision`,
        { decision: 'correction' },
      );
      expect(code(noNotes)).toBe('PRODUCTION_INVALID');
      ok(
        await clinic(
          'post',
          `/lab-orders/${orderId}/stages/${metal.id}/decision`,
          { decision: 'correction', notes: 'Margin open on 14' },
        ),
      );

      const stages = await stagesOf(orderId, itemId);
      const seq1 = stages.filter((s) => s.seq === 1);
      expect(seq1).toHaveLength(2);
      expect(seq1[0]).toMatchObject({
        id: metal.id,
        roundNo: 1,
        status: 'correction',
        outcome: 'correction',
        correctionNotes: 'Margin open on 14',
        isActive: false,
      });
      expect(seq1[1]).toMatchObject({
        roundNo: 2,
        status: 'at_lab',
        isActive: true,
      });
      expect(await itemStatus(itemId)).toBe('in_production');
      const outbox = await sqlRows<{ audience: string }>(
        fx.dataSource,
        `SELECT audience FROM notification_outbox WHERE event_code = 'stage.correction' AND entity_id = $1`,
        [orderId],
      );
      expect(outbox.length).toBeGreaterThan(0);
      expect(outbox.every((r) => r.audience === 'lab')).toBe(true);

      // Round 2 goes back, is approved, and the next stage starts.
      await receiveAll(await dispatch([itemId]));
      [, metal] = await stagesOf(orderId, itemId);
      ok(
        await clinic(
          'post',
          `/lab-orders/${orderId}/stages/${metal.id}/tryin`,
          {},
        ),
      );
      ok(
        await clinic(
          'post',
          `/lab-orders/${orderId}/stages/${metal.id}/decision`,
          { decision: 'approve' },
        ),
      );
      const after = await stagesOf(orderId, itemId);
      expect(after.map((s) => [s.seq, s.roundNo, s.status])).toEqual([
        [1, 1, 'correction'],
        [1, 2, 'approved'],
        [2, 1, 'at_lab'],
        [3, 1, 'pending'],
      ]);
      expect(after.filter((s) => s.isActive)).toHaveLength(1);
    });

    it('final work goes through QC, ships, is approved and delivered; the warranty starts', async () => {
      // Bisque try-in approved straight away.
      await receiveAll(await dispatch([itemId]));
      const bisque = (await stagesOf(orderId, itemId)).find(
        (s) => s.seq === 2,
      )!;
      ok(
        await clinic(
          'post',
          `/lab-orders/${orderId}/stages/${bisque.id}/tryin`,
          {},
        ),
      );
      ok(
        await clinic(
          'post',
          `/lab-orders/${orderId}/stages/${bisque.id}/decision`,
          { decision: 'approve' },
        ),
      );
      // Final stage at the lab: unfinished work can't ship.
      const notReady = await portal(
        'post',
        '/lab-portal/production/shipments',
        {
          lines: [{ itemId }],
        },
      );
      expect(code(notReady)).toBe('PRODUCTION_NOT_ALLOWED');

      ok(
        await portal(
          'post',
          `/lab-portal/production/items/${itemId}/finish`,
          {},
        ),
      );
      const noReason = await portal(
        'post',
        `/lab-portal/production/items/${itemId}/qc`,
        { result: 'fail' },
      );
      expect(noReason.status).toBe(422);
      ok(
        await portal('post', `/lab-portal/production/items/${itemId}/qc`, {
          result: 'fail',
          notes: 'Porcelain chip',
        }),
      );
      expect(await itemStatus(itemId)).toBe('in_production');
      ok(
        await portal(
          'post',
          `/lab-portal/production/items/${itemId}/finish`,
          {},
        ),
      );
      ok(
        await portal('post', `/lab-portal/production/items/${itemId}/qc`, {
          result: 'pass',
        }),
      );
      expect(await itemStatus(itemId)).toBe('ready');
      expect(await orderStatus(orderId)).toBe('ready');
      const ready = await sqlRows<{ audience: string }>(
        fx.dataSource,
        `SELECT audience FROM notification_outbox WHERE event_code = 'item.ready' AND entity_id = $1`,
        [orderId],
      );
      expect(ready.map((r) => r.audience)).toEqual(
        expect.arrayContaining(['doctor', 'patient']),
      );

      const shipment = await dispatch([itemId]);
      expect(shipment.lines[0]).toMatchObject({ contents: 'final' });
      expect(await itemStatus(itemId)).toBe('dispatched');
      await receiveAll(shipment);
      expect(await itemStatus(itemId)).toBe('received');
      expect(await orderStatus(orderId)).toBe('under_review');

      const final = (await stagesOf(orderId, itemId)).find((s) => s.isFinal)!;
      const correct = await clinic(
        'post',
        `/lab-orders/${orderId}/stages/${final.id}/decision`,
        { decision: 'correction', notes: 'x' },
      );
      expect(code(correct)).toBe('PRODUCTION_NOT_ALLOWED');
      ok(
        await clinic(
          'post',
          `/lab-orders/${orderId}/stages/${final.id}/tryin`,
          {},
        ),
      );
      ok(
        await clinic(
          'post',
          `/lab-orders/${orderId}/stages/${final.id}/decision`,
          { decision: 'approve' },
        ),
      );
      expect(await itemStatus(itemId)).toBe('approved');
      expect(await orderStatus(orderId)).toBe('completed');

      ok(
        await clinic(
          'post',
          `/lab-orders/${orderId}/items/${itemId}/deliver`,
          {},
        ),
      );
      const view = await production(orderId);
      expect(view.items[0]).toMatchObject({
        status: 'delivered',
        warranty: {
          startsOn: today,
          endsOn: warrantyEndsOn(today, 12),
          voidedAt: null,
        },
      });
      expect(view.items[0].stages.every((s: Stage) => !s.isActive)).toBe(true);
      expect(await orderStatus(orderId)).toBe('completed');
    });

    it('after-care remake on a delivered item is a warranty claim; agreeing reopens the completed order', async () => {
      const req = await clinic(
        'post',
        `/lab-orders/${orderId}/items/${itemId}/remake-requests`,
        { reasonCode: 'fracture', notes: 'Fractured after 2 weeks' },
      );
      expect(req.status).toBe(201);
      const [remake] = req.body.data.remakeRequests;
      expect(remake).toMatchObject({
        reasonCode: 'fracture',
        isWarrantyClaim: true,
        status: 'requested',
        responsibleParty: 'undetermined',
      });
      const undecided = await clinic(
        'post',
        `/lab-orders/${orderId}/remake-requests/${remake.id}/decision`,
        { decision: 'agree', version: remake.version },
      );
      expect(code(undecided)).toBe('PRODUCTION_INVALID');

      const agreed = ok(
        await clinic(
          'post',
          `/lab-orders/${orderId}/remake-requests/${remake.id}/decision`,
          {
            decision: 'agree',
            version: remake.version,
            responsibleParty: 'clinic',
          },
        ),
      );
      const newItem = agreed.items.find(
        (i: { remakeOfItemId: string | null }) => i.remakeOfItemId === itemId,
      );
      expect(newItem).toMatchObject({
        lineNo: 2,
        status: 'pending_acceptance',
      });
      expect(agreed.remakeRequests[0]).toMatchObject({
        status: 'agreed',
        newItemId: newItem.id,
        labChargeMinor: 800_000,
        patientChargeMinor: 0,
      });
      expect(await orderStatus(orderId)).not.toBe('completed');
      expect(await itemStatus(itemId)).toBe('delivered');
    });
  });

  describe('order status, receiving and exceptions', () => {
    it('acceptance: one item ready + one in production → order partially_ready', async () => {
      const o = await submitted([plain.id, plain.id]);
      const [i1, i2] = o.items.map((i) => i.id);
      for (const id of [i1, i2]) {
        await accept(id);
        ok(
          await portal('post', `/lab-portal/production/items/${id}/start`, {}),
        );
      }
      ok(await portal('post', `/lab-portal/production/items/${i1}/finish`, {}));
      ok(
        await portal('post', `/lab-portal/production/items/${i1}/qc`, {
          result: 'pass',
        }),
      );
      expect(await orderStatus(o.id)).toBe('partially_ready');
    });

    it('partial receiving, a lost parcel and re-shipping keep the order status derived (inv. 8)', async () => {
      const o = await submitted([plain.id, plain.id]);
      const [i1, i2] = o.items.map((i) => i.id);
      for (const id of [i1, i2]) {
        await accept(id);
        for (const step of ['start', 'finish'])
          ok(
            await portal(
              'post',
              `/lab-portal/production/items/${id}/${step}`,
              {},
            ),
          );
        ok(
          await portal('post', `/lab-portal/production/items/${id}/qc`, {
            result: 'pass',
          }),
        );
      }
      const shipment = await dispatch([i1, i2]);
      expect(shipment.shipmentNo).toMatch(/^SHP-/);
      expect(await orderStatus(o.id)).toBe('ready');

      const line1 = shipment.lines.find(
        (l: { itemId: string }) => l.itemId === i1,
      );
      const part = ok(
        await clinic('post', `/lab-shipments/${shipment.id}/receive`, {
          lines: [
            {
              shipmentItemId: line1.id,
              receivedQty: 1,
              condition: 'damaged',
              qcResult: 'fail',
              qcNotes: 'Cracked box',
            },
          ],
        }),
      );
      expect(part.status).toBe('partially_received');
      expect(await itemStatus(i1)).toBe('received');
      expect(await itemStatus(i2)).toBe('dispatched');
      expect(await orderStatus(o.id)).toBe('partially_received');

      const twice = await clinic(
        'post',
        `/lab-shipments/${shipment.id}/receive`,
        {
          lines: [
            { shipmentItemId: line1.id, receivedQty: 1, condition: 'ok' },
          ],
        },
      );
      expect(code(twice)).toBe('PRODUCTION_NOT_ALLOWED');
      // Still in transit → can't be shipped again yet.
      const early = await portal('post', '/lab-portal/production/shipments', {
        lines: [{ itemId: i2 }],
      });
      expect(code(early)).toBe('PRODUCTION_NOT_ALLOWED');

      const lost = ok(
        await portal(
          'post',
          `/lab-portal/production/shipments/${shipment.id}/lost`,
          {
            reason: 'Courier lost the second box',
          },
        ),
      );
      expect(lost.status).toBe('lost');
      expect(
        lost.lines.find((l: { itemId: string }) => l.itemId === i2),
      ).toMatchObject({ condition: 'missing', receivedQty: 0 });
      expect(await itemStatus(i2)).toBe('dispatched');
      const lostOutbox = await sqlRows<{ audience: string }>(
        fx.dataSource,
        `SELECT DISTINCT audience FROM notification_outbox WHERE event_code = 'shipment.lost' AND entity_id = $1`,
        [shipment.id],
      );
      expect(lostOutbox.map((r) => r.audience).sort()).toEqual([
        'doctor',
        'lab',
      ]);

      const again = await dispatch([i2]);
      await receiveAll(again);
      expect(await itemStatus(i2)).toBe('received');
      expect(await orderStatus(o.id)).toBe('under_review');

      // Work without stages is approved directly; both approved → completed.
      for (const id of [i1, i2])
        ok(await clinic('post', `/lab-orders/${o.id}/items/${id}/approve`, {}));
      expect(await orderStatus(o.id)).toBe('completed');
    });

    it('the clinic sends impressions to the lab; the lab receives them', async () => {
      const o = await submitted([plain.id]);
      const sent = ok(
        await clinic('post', '/lab-shipments', {
          lines: [{ itemId: o.items[0].id, contents: 'impression' }],
        }),
        201,
      );
      expect(sent).toMatchObject({ direction: 'to_lab', status: 'dispatched' });
      const wrongSide = await clinic(
        'post',
        `/lab-shipments/${sent.id}/receive`,
        {
          lines: [
            {
              shipmentItemId: sent.lines[0].id,
              receivedQty: 1,
              condition: 'ok',
            },
          ],
        },
      );
      expect(code(wrongSide)).toBe('PRODUCTION_NOT_ALLOWED');
      const got = ok(
        await portal(
          'post',
          `/lab-portal/production/shipments/${sent.id}/receive`,
          {
            lines: [
              {
                shipmentItemId: sent.lines[0].id,
                receivedQty: 1,
                condition: 'ok',
              },
            ],
          },
        ),
      );
      expect(got.status).toBe('received');
      expect(await itemStatus(o.items[0].id)).toBe('pending_acceptance');
    });
  });

  describe('remakes', () => {
    it('lab fault: rejected work → remake request → new item with lab cost and patient price 0', async () => {
      const o = await submitted([plain.id]);
      const itemId = o.items[0].id;
      await toReceived(itemId);
      const rej = ok(
        await clinic('post', `/lab-orders/${o.id}/items/${itemId}/reject`, {
          reasonCode: 'fit',
          reason: 'Does not seat',
        }),
      );
      expect(await itemStatus(itemId)).toBe('remake_required');
      const [remake] = rej.remakeRequests;
      expect(remake).toMatchObject({
        reasonCode: 'fit',
        notes: 'Does not seat',
        isWarrantyClaim: false,
        status: 'requested',
      });
      const requested = await sqlRows<{ audience: string }>(
        fx.dataSource,
        `SELECT audience FROM notification_outbox WHERE event_code = 'remake.requested' AND entity_id = $1`,
        [remake.id],
      );
      expect(requested.length).toBeGreaterThan(0);

      // The lab disputes; the clinic still agrees it was the lab's fault.
      const labList = ok(
        await portal('get', '/lab-portal/production/remake-requests'),
      );
      expect(JSON.stringify(labList)).not.toMatch(/patientChargeMinor/);
      ok(
        await portal(
          'post',
          `/lab-portal/production/remake-requests/${remake.id}/dispute`,
          { version: remake.version, note: 'Impression was distorted' },
        ),
      );
      const [disputed] = (await production(o.id)).remakeRequests;
      expect(disputed).toMatchObject({
        status: 'disputed',
        disputeNote: 'Impression was distorted',
      });
      const agreed = ok(
        await clinic(
          'post',
          `/lab-orders/${o.id}/remake-requests/${remake.id}/decision`,
          {
            decision: 'agree',
            version: disputed.version,
            responsibleParty: 'lab',
          },
        ),
      );
      expect(agreed.remakeRequests[0]).toMatchObject({
        status: 'agreed',
        labChargeMinor: 0,
        patientChargeMinor: 0,
      });
      const order = (await clinic('get', `/lab-orders/${o.id}`)).body.data;
      const remade = order.items.find(
        (i: { lineNo: number }) => i.lineNo === 2,
      );
      expect(remade).toMatchObject({
        status: 'pending_acceptance',
        prices: { labLineCostMinor: 0, patientLinePriceMinor: 0 },
      });
      expect(order.status).toBe('submitted');
      const [history] = await sqlRows<{ action_code: string }>(
        fx.dataSource,
        `SELECT action_code FROM status_history WHERE entity_id = $1`,
        [remade.id],
      );
      expect(history.action_code).toBe('remake');
    });

    it('patient fault keeps both original prices', async () => {
      const o = await submitted([plain.id]);
      const itemId = o.items[0].id;
      await toReceived(itemId);
      const rej = ok(
        await clinic('post', `/lab-orders/${o.id}/items/${itemId}/reject`, {
          reasonCode: 'shade',
          reason: 'Patient wants a lighter shade',
        }),
      );
      const [remake] = rej.remakeRequests;
      const agreed = ok(
        await clinic(
          'post',
          `/lab-orders/${o.id}/remake-requests/${remake.id}/decision`,
          {
            decision: 'agree',
            version: remake.version,
            responsibleParty: 'patient',
          },
        ),
      );
      expect(agreed.remakeRequests[0]).toMatchObject({
        labChargeMinor: o.items[0].prices.labLineCostMinor,
        patientChargeMinor: o.items[0].prices.patientLinePriceMinor,
      });
      expect(o.items[0].prices.patientLinePriceMinor).toBeGreaterThan(0);
    });
  });

  describe('lab side', () => {
    it('assigns technicians (admins only), closing the previous assignment', async () => {
      const o = await submitted([plain.id]);
      const itemId = o.items[0].id;
      await accept(itemId);
      const techs = ok(
        await portal('get', '/lab-portal/production/technicians'),
      );
      const tech = techs.find(
        (t: { role: string }) => t.role === 'lab_technician',
      );
      const admin = techs.find((t: { role: string }) => t.role === 'lab_admin');
      ok(
        await portal('post', `/lab-portal/production/items/${itemId}/assign`, {
          labMemberId: tech.id,
        }),
      );
      ok(
        await portal('post', `/lab-portal/production/items/${itemId}/assign`, {
          labMemberId: admin.id,
        }),
      );
      const rows = await sqlRows<{
        lab_member_id: string;
        unassigned_at: Date | null;
      }>(
        fx.dataSource,
        `SELECT lab_member_id, unassigned_at FROM item_assignments WHERE item_id = $1 ORDER BY assigned_at`,
        [itemId],
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].unassigned_at).not.toBeNull();
      expect(rows[1]).toMatchObject({
        lab_member_id: admin.id,
        unassigned_at: null,
      });

      const denied = await portal(
        'post',
        `/lab-portal/production/items/${itemId}/assign`,
        { labMemberId: tech.id },
        technician.id,
      );
      expect(denied.status).toBe(403);
      // Technicians do bench work.
      ok(
        await portal(
          'post',
          `/lab-portal/production/items/${itemId}/start`,
          {},
          technician.id,
        ),
      );
      const list = ok(
        await portal(
          'get',
          `/lab-portal/production/items?assigneeId=${admin.id}`,
        ),
      );
      expect(list.data.map((i: { id: string }) => i.id)).toContain(itemId);
      expect(JSON.stringify(list)).not.toMatch(/patient(Unit|Line)Price/);
    });

    it('another lab sees none of it', async () => {
      const list = ok(
        await portal(
          'get',
          '/lab-portal/production/items',
          undefined,
          otherLabAdmin.id,
        ),
      );
      expect(list.total).toBe(0);
      const ships = ok(await portal('get', '/lab-portal/production/shipments'));
      const first = ships.data[0];
      const peek = await portal(
        'get',
        `/lab-portal/production/shipments/${first.id}`,
        undefined,
        otherLabAdmin.id,
      );
      expect(peek.status).toBe(404);
      const o = await submitted([plain.id]);
      await accept(o.items[0].id);
      const start = await portal(
        'post',
        `/lab-portal/production/items/${o.items[0].id}/start`,
        {},
        otherLabAdmin.id,
      );
      expect(code(start)).toBe('PRODUCTION_ITEM_NOT_FOUND');
    });
  });
});
