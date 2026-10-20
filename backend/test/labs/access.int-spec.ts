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
import { FormSchema } from 'src/engine/entities/form-schema.entity';
import { WorkflowTemplate } from 'src/engine/entities/workflow-template.entity';
import { LabAccessModule } from 'src/lab-access/lab-access.module';
import { ServiceCategory } from 'src/lab-catalog/entities/service-category.entity';
import { LabCatalogModule } from 'src/lab-catalog/lab-catalog.module';
import { LabOrdersModule } from 'src/lab-orders/lab-orders.module';
import { PayloadFinalizers } from 'src/notifications/delivery/payload-finalizers';
import type { NotificationPayload } from 'src/notifications/entities/notification-outbox.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';
import type {
  NotificationAudience,
  NotificationChannel,
  RecipientType,
} from 'src/notifications/notifications.enums';
import { Patient } from 'src/patients/entities/patient.entity';
import { Clinic, LabsFixture, createLabsFixture } from './labs-it.harness';

const code = (res: Response): string | undefined =>
  (res.body?.error?.code ?? res.body?.code) as string | undefined;

interface OutboxRow {
  id: string;
  event_code: string;
  audience: string;
  recipient_type: string;
  recipient_id: string;
  channel: string;
  status: string;
  payload: NotificationPayload;
  entity_id: string | null;
}

/**
 * Sprint 7 — lab access (lab ERD §7, §10 "Lab accept", §13, §14 steps 4–5,
 * §19 "expired or revoked magic link → no action"): magic links, the lab
 * portal's answers, proxy mode, internal notifications, the QR resolver.
 */
describe('Lab access (API)', () => {
  let fx: LabsFixture;
  let A: Clinic;
  let B: Clinic;
  let lab: { id: string };
  let labAdmin: { id: string; email: string };
  let labTech: { id: string; email: string };
  let labBAdmin: { id: string; email: string };
  let service: { id: string };
  let patientId: string;
  const today = localDate('Asia/Karachi', new Date());
  const inDays = (n: number) => addDays(today, n);

  const crown = (teeth = ['11', '21']) => ({
    teeth: teeth.map((tooth) => ({ tooth })),
    material: 'zirconia_monolithic',
    shade_system: 'VITA_classical',
    shade: 'A2',
    impression_type: 'physical',
  });

  const http = () => request(fx.app.getHttpServer());

  const portal = (
    as: string,
    method: 'get' | 'post',
    url: string,
    body?: object,
  ) => http()[method](url).set('x-test-user', as).send(body);

  /** Magic-link routes are public; the test auth guard still wants some header. */
  const link = (
    method: 'get' | 'post',
    token: string,
    path = '',
    body?: object,
  ) =>
    http()
      [method](`/lab-link/${token}${path}`)
      .set('x-test-user', randomUUID())
      .send(body);

  const submitted = async (): Promise<{ id: string; orderNo: string }> => {
    const d = await fx.clinic('post', '/lab-orders', A, A.doctor, {
      patientId,
      labId: lab.id,
      items: [
        { labServiceId: service.id, answers: crown() },
        { labServiceId: service.id, answers: crown(['36']) },
      ],
    });
    expect(d.status).toBe(201);
    const s = await http()
      .post(`/lab-orders/${d.body.data.id}/submit`)
      .set('x-test-user', A.doctor)
      .set('x-organization-id', A.organizationId)
      .set('x-location-id', A.locationId)
      .set('idempotency-key', randomUUID())
      .send({ version: d.body.data.version });
    expect(s.status).toBe(201);
    return { id: d.body.data.id, orderNo: s.body.data.orderNo };
  };

  const order = async (id: string) =>
    (await fx.clinic('get', `/lab-orders/${id}`, A, A.doctor)).body.data;

  const outbox = (entityId: string, eventCode?: string) =>
    sqlRows<OutboxRow>(
      fx.dataSource,
      `SELECT id, event_code, audience, recipient_type, recipient_id, channel, status,
              payload, entity_id
         FROM notification_outbox
        WHERE entity_id = $1 AND ($2::text IS NULL OR event_code = $2)
        ORDER BY created_at`,
      [entityId, eventCode ?? null],
    );

  const history = (orderId: string) =>
    sqlRows<{
      entity_type: string;
      action_code: string;
      to_state: string;
      via: string;
      actor_side: string;
      actor_user_id: string | null;
      on_behalf_of_lab_id: string | null;
      metadata: { input?: Record<string, unknown> } | null;
    }>(
      fx.dataSource,
      `SELECT h.entity_type, h.action_code, h.to_state, h.via, h.actor_side,
              h.actor_user_id, h.on_behalf_of_lab_id, h.metadata
         FROM status_history h
        WHERE h.entity_id = $1
           OR h.entity_id IN (SELECT id FROM lab_order_items WHERE order_id = $1)
        ORDER BY h.created_at, h.id`,
      [orderId],
    );

  /** The submit-time link's token, as the worker would put it in the message. */
  const tokenOf = async (orderId: string): Promise<string> => {
    const [links] = await sqlRows<{ id: string }>(
      fx.dataSource,
      `SELECT id FROM magic_links WHERE order_id = $1 ORDER BY created_at LIMIT 1`,
      [orderId],
    );
    const [row] = await outbox(links.id, 'order.magic_link');
    const finalized = await fx.app.get(PayloadFinalizers).apply({
      id: row.id,
      organizationId: A.organizationId,
      eventCode: row.event_code,
      audience: row.audience as NotificationAudience,
      recipientType: row.recipient_type as RecipientType,
      recipientId: row.recipient_id,
      channel: row.channel as NotificationChannel,
      payload: row.payload,
      attempts: 1,
    });
    const m = /\/lab-link\/([A-Za-z0-9_-]{43})/.exec(finalized.payload.body);
    expect(m).not.toBeNull();
    return m![1];
  };

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_access_api', [
      LabCatalogModule,
      LabOrdersModule,
      NotificationsModule,
      LabAccessModule,
    ]);
    A = fx.clinicA;
    B = fx.clinicB;
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

    const newLab = async (name: string, admin: { email: string }) => {
      const created = await fx.platform(
        'post',
        '/platform/labs',
        fx.superAdmin,
        {
          name: `${name} ${randomUUID().slice(0, 6)}`,
          labType: 'external',
          city: 'Lahore',
          whatsappPhone: '03211234567',
        },
      );
      expect(created.status).toBe(201);
      await fx.platform(
        'post',
        `/platform/labs/${created.body.data.id}/members`,
        fx.superAdmin,
        { email: admin.email, role: 'lab_admin' },
      );
      return created.body.data as { id: string };
    };
    labAdmin = await fx.newUser('lab-admin');
    labBAdmin = await fx.newUser('lab-b-admin');
    labTech = await fx.newUser('lab-tech');
    lab = await newLab('Access IT Lab', labAdmin);
    // Lab B: a second lab whose admin must never see lab A's orders.
    await newLab('Other IT Lab', labBAdmin);
    await fx.platform(
      'post',
      `/platform/labs/${lab.id}/members`,
      fx.superAdmin,
      { email: labTech.email, role: 'lab_technician' },
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
    const p = await fx.platform(
      'post',
      `/platform/labs/${lab.id}/services/${service.id}/prices`,
      fx.superAdmin,
      { unitPricePaisa: 500_000, effectiveFrom: today },
    );
    expect(p.status).toBe(201);

    const l = await fx.clinic('post', '/lab-links', A, A.admin, {
      labId: lab.id,
    });
    await fx.clinic(
      'post',
      `/lab-links/${l.body.data.id}/transitions`,
      A,
      A.admin,
      { action: 'activate', version: 1 },
    );

    const t = await m.getRepository(CatalogService).save({
      organizationId: A.organizationId,
      name: 'Zirconia crown',
      kind: ServiceKind.PROCEDURE,
      defaultPrice: 15_000,
    });
    const map = await fx.clinic('post', '/lab-catalog/mappings', A, A.admin, {
      clinicTreatmentId: t.id,
      labServiceId: service.id,
    });
    expect(map.status).toBe(201);

    const patient = await m.getRepository(Patient).save({
      organizationId: A.organizationId,
      patientNumber: `P-${randomUUID().slice(0, 6)}`,
      fullName: 'Ali Raza',
      phone: '03001234567',
    } as Partial<Patient>);
    patientId = patient.id;
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  describe('magic links', () => {
    it('submit creates a link and an outbox message without the token; the worker fills the URL in', async () => {
      const o = await submitted();
      const [stored] = await sqlRows<{
        id: string;
        token_hash: string;
        lab_id: string;
        purpose: string;
        expires_at: Date;
        created_at: Date;
      }>(
        fx.dataSource,
        `SELECT id, token_hash, lab_id, purpose, expires_at, created_at
           FROM magic_links WHERE order_id = $1`,
        [o.id],
      );
      expect(stored).toMatchObject({
        lab_id: lab.id,
        purpose: 'lab_update_order',
      });
      expect(stored.token_hash).toMatch(/^[0-9a-f]{64}$/);
      const hours =
        (new Date(stored.expires_at).getTime() -
          new Date(stored.created_at).getTime()) /
        3_600_000;
      expect(Math.round(hours)).toBe(24);

      const rows = await outbox(stored.id, 'order.magic_link');
      expect(rows.map((r) => r.channel).sort()).toEqual(['email', 'whatsapp']);
      const wa = rows.find((r) => r.channel === 'whatsapp')!;
      expect(wa).toMatchObject({ audience: 'lab', recipient_type: 'lab' });
      expect(wa.payload.to).toBe('03211234567');
      // The stored message holds a placeholder, never a token.
      expect(wa.payload.body).toContain(`[magic-link:${stored.id}]`);
      expect(JSON.stringify(rows)).not.toMatch(/\/lab-link\//);

      const token = await tokenOf(o.id);
      const view = await link('get', token);
      expect(view.status).toBe(200);
      expect(view.body.data.order).toMatchObject({
        id: o.id,
        orderNo: o.orderNo,
        status: 'submitted',
        patient: { ref: 'Ali Raza' },
      });
      expect(view.body.data.actions).toEqual(
        expect.arrayContaining(['accept', 'reject', 'request_clarification']),
      );
      expect(JSON.stringify(view.body.data)).not.toMatch(
        /patientUnitPrice|patientLinePrice|patientPrice|clinicTreatmentId|organizationId/,
      );
    });

    it('accept through a link: items accepted, order accepted, history via magic_link, doctor notified', async () => {
      const o = await submitted();
      const token = await tokenOf(o.id);
      const bad = await link('post', token, '/accept', {
        labExpectedOn: addDays(today, -1),
      });
      expect(code(bad)).toBe('LAB_EXPECTED_DATE_INVALID');

      const res = await link('post', token, '/accept', {
        labExpectedOn: inDays(6),
      });
      expect(res.status).toBe(201);
      const after = await order(o.id);
      expect(after.status).toBe('accepted');
      expect(after.labExpectedOn).toBe(inDays(6));
      expect(after.items.map((i: { status: string }) => i.status)).toEqual([
        'accepted',
        'accepted',
      ]);
      const h = await history(o.id);
      const accepts = h.filter((x) => x.action_code === 'accept');
      expect(accepts).toHaveLength(2);
      for (const x of accepts) {
        expect(x).toMatchObject({
          via: 'magic_link',
          actor_side: 'lab',
          actor_user_id: null,
        });
        expect(x.metadata?.input).toMatchObject({
          lab_expected_on: inDays(6),
          magic_link_id: expect.any(String),
        });
      }
      const [{ used_count }] = await sqlRows<{ used_count: number }>(
        fx.dataSource,
        `SELECT used_count FROM magic_links WHERE order_id = $1`,
        [o.id],
      );
      expect(used_count).toBe(1);
      const notes = await outbox(o.id, 'order.accepted');
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.every((n) => n.audience === 'doctor')).toBe(true);
      expect(notes.find((n) => n.channel === 'in_app')).toMatchObject({
        recipient_id: A.doctor,
        status: 'queued',
      });
      // The order is no longer waiting: the same link can't accept again.
      const again = await link('post', token, '/accept', {
        labExpectedOn: inDays(6),
      });
      expect(code(again)).toBe('LAB_ACTION_NOT_ALLOWED');
    });

    it('an expired link does nothing (§19)', async () => {
      const o = await submitted();
      const token = await tokenOf(o.id);
      await fx.dataSource.query(
        `UPDATE magic_links SET expires_at = now() - interval '1 minute' WHERE order_id = $1`,
        [o.id],
      );
      expect((await link('get', token)).status).toBe(410);
      const res = await link('post', token, '/accept', {
        labExpectedOn: inDays(5),
      });
      expect(res.status).toBe(410);
      expect(code(res)).toBe('MAGIC_LINK_EXPIRED');
      const rej = await link('post', token, '/reject', { reason: 'x' });
      expect(rej.status).toBe(410);
      const after = await order(o.id);
      expect(after.status).toBe('submitted');
      expect(
        after.items.every(
          (i: { status: string }) => i.status === 'pending_acceptance',
        ),
      ).toBe(true);
      expect((await history(o.id)).some((h) => h.via === 'magic_link')).toBe(
        false,
      );
    });

    it('a revoked link does nothing (§19); the clinic sees it as revoked', async () => {
      const o = await submitted();
      const token = await tokenOf(o.id);
      const list = await fx.clinic(
        'get',
        `/lab-orders/${o.id}/magic-links`,
        A,
        A.doctor,
      );
      expect(list.status).toBe(200);
      const [l] = list.body.data;
      expect(l).toMatchObject({ state: 'active', delivery: 'notification' });
      expect(
        l.deliveries.map((d: { channel: string }) => d.channel).sort(),
      ).toEqual(['email', 'whatsapp']);
      const rev = await fx.clinic(
        'post',
        `/lab-orders/${o.id}/magic-links/${l.id}/revoke`,
        A,
        A.doctor,
      );
      expect(rev.status).toBe(201);
      const res = await link('post', token, '/clarification', {
        body: 'Which shade?',
      });
      expect(res.status).toBe(410);
      expect(code(res)).toBe('MAGIC_LINK_REVOKED');
      expect((await order(o.id)).status).toBe('submitted');
      const after = await fx.clinic(
        'get',
        `/lab-orders/${o.id}/magic-links`,
        A,
        A.doctor,
      );
      expect(after.body.data[0].state).toBe('revoked');
      // The worker won't send a revoked link either.
      await expect(tokenOf(o.id)).rejects.toThrow(/revoked or expired/);
    });

    it('a link for order X cannot act on order Y; unknown tokens are 404', async () => {
      const x = await submitted();
      const y = await submitted();
      const tokenX = await tokenOf(x.id);
      const res = await link('post', tokenX, '/reject', {
        reason: 'Not our material',
      });
      expect(res.status).toBe(201);
      expect((await order(x.id)).status).toBe('rejected_by_lab');
      expect((await order(y.id)).status).toBe('submitted');
      expect((await history(y.id)).some((h) => h.via === 'magic_link')).toBe(
        false,
      );
      // Rejecting closed X, so its link is gone too.
      expect(code(await link('get', tokenX))).toBe('MAGIC_LINK_REVOKED');
      const fake = 'A'.repeat(43);
      expect(code(await link('get', fake))).toBe('MAGIC_LINK_INVALID');
      expect((await link('get', 'short')).status).toBe(404);
    });

    it('cancel auto-revokes; a copied view-only link can only show the order', async () => {
      const o = await submitted();
      const copy = await fx.clinic(
        'post',
        `/lab-orders/${o.id}/magic-links`,
        A,
        A.doctor,
        { delivery: 'copy', purpose: 'lab_view_order', expiresInHours: 2 },
      );
      expect(copy.status).toBe(201);
      const token = /\/lab-link\/([A-Za-z0-9_-]{43})$/.exec(
        copy.body.data.url as string,
      )![1];
      const view = await link('get', token);
      expect(view.status).toBe(200);
      expect(view.body.data.actions).toEqual([]);
      expect(
        code(
          await link('post', token, '/accept', { labExpectedOn: inDays(4) }),
        ),
      ).toBe('MAGIC_LINK_FORBIDDEN');

      const cur = await order(o.id);
      const cancel = await fx.clinic(
        'post',
        `/lab-orders/${o.id}/transitions`,
        A,
        A.doctor,
        { action: 'cancel', version: cur.version, reason: 'Patient left' },
      );
      expect(cancel.status).toBe(201);
      const links = await sqlRows<{ revoked_reason: string | null }>(
        fx.dataSource,
        `SELECT revoked_reason FROM magic_links WHERE order_id = $1`,
        [o.id],
      );
      expect(links).toHaveLength(2);
      expect(links.every((l) => l.revoked_reason === 'order_closed')).toBe(
        true,
      );
      expect(code(await link('get', token))).toBe('MAGIC_LINK_REVOKED');
    });
  });

  describe('lab portal', () => {
    it('lab A’s order is invisible to lab B', async () => {
      const o = await submitted();
      const list = await portal(labBAdmin.id, 'get', '/lab-portal/orders');
      expect(list.status).toBe(200);
      expect(list.body.data.total).toBe(0);
      expect(
        (await portal(labBAdmin.id, 'get', `/lab-portal/orders/${o.id}`))
          .status,
      ).toBe(404);
      const acc = await portal(
        labBAdmin.id,
        'post',
        `/lab-portal/orders/${o.id}/accept`,
        { labExpectedOn: inDays(5) },
      );
      expect(acc.status).toBe(404);
      expect((await order(o.id)).status).toBe('submitted');
      const mine = await portal(labAdmin.id, 'get', '/lab-portal/orders');
      expect(
        mine.body.data.data.some((r: { id: string }) => r.id === o.id),
      ).toBe(true);
    });

    it('a technician can’t accept; the admin accepts (via portal) and later moves the date', async () => {
      const o = await submitted();
      const actions = await portal(
        labTech.id,
        'get',
        `/lab-portal/orders/${o.id}/actions`,
      );
      expect(actions.body.data.actions).toEqual([]);
      const tech = await portal(
        labTech.id,
        'post',
        `/lab-portal/orders/${o.id}/accept`,
        { labExpectedOn: inDays(5) },
      );
      expect(tech.status).toBe(403);

      const adminActions = await portal(
        labAdmin.id,
        'get',
        `/lab-portal/orders/${o.id}/actions`,
      );
      expect(adminActions.body.data.actions).toEqual([
        'accept',
        'reject',
        'request_clarification',
      ]);
      const res = await portal(
        labAdmin.id,
        'post',
        `/lab-portal/orders/${o.id}/accept`,
        { labExpectedOn: inDays(5), note: 'Starting Monday' },
      );
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        status: 'accepted',
        labExpectedOn: inDays(5),
      });
      const h = (await history(o.id)).filter((x) => x.action_code === 'accept');
      expect(
        h.every((x) => x.via === 'portal' && x.actor_user_id === labAdmin.id),
      ).toBe(true);

      const move = await portal(
        labAdmin.id,
        'post',
        `/lab-portal/orders/${o.id}/expected-date`,
        { labExpectedOn: inDays(9), reason: 'Furnace down' },
      );
      expect(move.status).toBe(201);
      expect(move.body.data.labExpectedOn).toBe(inDays(9));
      const [changed] = await outbox(o.id, 'order.expected_date_changed');
      expect(changed).toMatchObject({ audience: 'doctor', status: 'queued' });
      expect(changed.payload.body).toContain(inDays(5));
      expect(changed.payload.body).toContain(inDays(9));
      expect(
        (
          await portal(
            labTech.id,
            'post',
            `/lab-portal/orders/${o.id}/expected-date`,
            { labExpectedOn: inDays(10), reason: 'x' },
          )
        ).status,
      ).toBe(403);
    });

    it('clarification: message + clarification_needed + the doctor is told; reject needs a reason', async () => {
      const o = await submitted();
      const ask = await portal(
        labAdmin.id,
        'post',
        `/lab-portal/orders/${o.id}/clarification`,
        { body: 'Shade for 36?' },
      );
      expect(ask.status).toBe(201);
      expect(ask.body.data.status).toBe('clarification_needed');
      expect(ask.body.data.messages).toEqual([
        expect.objectContaining({
          kind: 'clarification_request',
          authorSide: 'lab',
          body: 'Shade for 36?',
        }),
      ]);
      const [n] = await outbox(o.id, 'order.clarification_requested');
      expect(n).toMatchObject({ audience: 'doctor', recipient_id: A.doctor });
      expect(n.payload.body).toContain('Shade for 36?');
      // Not waiting for acceptance any more.
      const acc = await portal(
        labAdmin.id,
        'post',
        `/lab-portal/orders/${o.id}/accept`,
        { labExpectedOn: inDays(5) },
      );
      expect(code(acc)).toBe('LAB_ACTION_NOT_ALLOWED');

      const o2 = await submitted();
      const noReason = await portal(
        labAdmin.id,
        'post',
        `/lab-portal/orders/${o2.id}/reject`,
        { reason: '' },
      );
      expect(noReason.status).toBe(400);
      const rej = await portal(
        labAdmin.id,
        'post',
        `/lab-portal/orders/${o2.id}/reject`,
        { reason: 'No zirconia in stock' },
      );
      expect(rej.status).toBe(201);
      expect(rej.body.data.status).toBe('rejected_by_lab');
      const [r] = await outbox(o2.id, 'order.rejected');
      expect(r.payload.body).toContain('No zirconia in stock');
    });
  });

  describe('proxy mode', () => {
    it('a clinic admin accepts for the lab: via proxy, on_behalf_of_lab_id; a doctor can’t', async () => {
      const o = await submitted();
      const doc = await fx.clinic(
        'post',
        `/lab-orders/${o.id}/proxy/accept`,
        A,
        A.doctor,
        { labExpectedOn: inDays(7) },
      );
      expect(doc.status).toBe(403);
      const acts = await fx.clinic(
        'get',
        `/lab-orders/${o.id}/proxy/actions`,
        A,
        A.admin,
      );
      expect(acts.body.data.actions).toEqual(
        expect.arrayContaining(['accept', 'reject', 'request_clarification']),
      );
      const res = await fx.clinic(
        'post',
        `/lab-orders/${o.id}/proxy/accept`,
        A,
        A.admin,
        { labExpectedOn: inDays(7) },
      );
      expect(res.status).toBe(201);
      expect((await order(o.id)).status).toBe('accepted');
      const accepts = (await history(o.id)).filter(
        (x) => x.action_code === 'accept',
      );
      expect(accepts).toHaveLength(2);
      for (const x of accepts) {
        expect(x).toMatchObject({
          via: 'proxy',
          on_behalf_of_lab_id: lab.id,
          actor_user_id: A.admin,
          actor_side: 'clinic',
        });
      }
      // Another clinic can't proxy on A's order.
      const other = await fx.clinic(
        'post',
        `/lab-orders/${o.id}/proxy/expected-date`,
        B,
        B.admin,
        { labExpectedOn: inDays(8), reason: 'x' },
      );
      expect(other.status).toBe(404);
    });
  });

  describe('work-order QR', () => {
    it('sends lab members to the portal and clinic staff to the clinic order; others get 404', async () => {
      const o = await submitted();
      const asLab = await fx.platform(
        'get',
        `/order-links/${o.id}`,
        labTech.id,
      );
      expect(asLab.body.data).toEqual({
        target: 'lab',
        labId: lab.id,
        path: `/lab-portal/orders/${o.id}`,
      });
      const asDoctor = await fx.platform(
        'get',
        `/order-links/${o.id}`,
        A.doctor,
      );
      expect(asDoctor.body.data).toEqual({
        target: 'clinic',
        organizationId: A.organizationId,
        locationId: A.locationId,
        path: `/lab-orders/${o.id}`,
      });
      expect(
        (await fx.platform('get', `/order-links/${o.id}`, labBAdmin.id)).status,
      ).toBe(404);
      expect(
        (await fx.platform('get', `/order-links/${o.id}`, B.admin)).status,
      ).toBe(404);
      const work = await fx.clinic(
        'get',
        `/lab-orders/${o.id}/work-order`,
        A,
        A.doctor,
      );
      expect(work.body.data.qrValue).toMatch(new RegExp(`/o/${o.id}$`));
    });
  });
});
