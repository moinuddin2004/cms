/* Supertest bodies are untyped JSON; these suites assert on their shape. */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { randomUUID } from 'crypto';
import type { Response } from 'supertest';
import type { EntityManager } from 'typeorm';
import { TransitionVia } from 'src/common/audit/audit.enums';
import { StatusHistory } from 'src/common/audit/entities/status-history.entity';
import { sqlRows } from 'src/common/database/sql';
import { EngineException } from 'src/engine/common/engine-errors';
import { EffectRegistry } from 'src/engine/runtime/effect-registry';
import type {
  SubjectAdapter,
  TransitionActor,
  WorkflowSubject,
} from 'src/engine/runtime/runtime.types';
import { WorkflowEngine } from 'src/engine/runtime/workflow-engine.service';
import { EngineSeedService } from 'src/engine/seeds/engine-seed.service';
import {
  deriveOrderStatus,
  isDerivable,
} from 'src/engine/workflows/order-status';
import { LabsFixture, createLabsFixture } from './labs-it.harness';

const code = (res: Response): string | undefined =>
  (res.body?.error?.code ?? res.body?.code) as string | undefined;

/**
 * Sprint 3 — engine II. Order tables arrive in Sprint 6, so two throwaway
 * tables (`it_orders`, `it_items`) with adapters stand in for them; the
 * engine code under test is the real one.
 */
describe('Engine integration — workflows, transition() and stage templates', () => {
  let fx: LabsFixture;
  let engine: WorkflowEngine;
  let orderVersionId: string;
  let itemVersionId: string;
  const labId = randomUUID();

  const lab: TransitionActor = {
    userId: null,
    side: 'lab',
    roles: ['lab_admin'],
  };
  const tech: TransitionActor = {
    userId: null,
    side: 'lab',
    roles: ['lab_technician'],
  };
  const doctor: TransitionActor = {
    userId: null,
    side: 'clinic',
    roles: ['doctor'],
  };
  const system: TransitionActor = { userId: null, side: 'system', roles: [] };

  const lock =
    (table: string) =>
    async (
      m: EntityManager,
      organizationId: string,
      id: string,
    ): Promise<WorkflowSubject | null> => {
      const [row] = await sqlRows<{
        id: string;
        organization_id: string;
        workflow_version_id: string;
        status: string;
        version: number;
        lab_id: string | null;
      }>(
        m,
        `SELECT * FROM ${table} WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [id, organizationId],
      );
      return row
        ? {
            id: row.id,
            organizationId: row.organization_id,
            workflowVersionId: row.workflow_version_id,
            state: row.status,
            version: row.version,
            labId: row.lab_id,
          }
        : null;
    };
  const setState =
    (table: string) =>
    async (
      m: EntityManager,
      s: WorkflowSubject,
      to: string,
    ): Promise<number> => {
      const [row] = await sqlRows<{ version: number }>(
        m,
        `UPDATE ${table} SET status = $2, version = version + 1 WHERE id = $1 RETURNING version`,
        [s.id, to],
      );
      return row.version;
    };

  /** §9c: re-derive the order from its items (what Sprint 6's adapter will do). */
  const deriveOrder = async (
    m: EntityManager,
    organizationId: string,
    orderId: string,
  ) => {
    const order = (await lock('it_orders')(m, organizationId, orderId))!;
    if (!isDerivable(order.state)) return;
    const items = await sqlRows<{ status: string }>(
      m,
      `SELECT status FROM it_items WHERE order_id = $1`,
      [orderId],
    );
    const next = deriveOrderStatus({
      itemStatuses: items.map((i) => i.status),
      onHold: order.state === 'on_hold',
    });
    await engine.applyDerived(m, 'it_order', order, next, {
      cause: 'item_changed',
    });
  };

  const orderAdapter: SubjectAdapter = {
    entityType: 'it_order',
    lock: lock('it_orders'),
    setState: setState('it_orders'),
    recompute: (s, { m }) => deriveOrder(m, s.organizationId, s.id),
  };
  const itemAdapter: SubjectAdapter = {
    entityType: 'it_item',
    lock: lock('it_items'),
    setState: setState('it_items'),
    afterTransition: async (s, { m }) => {
      const [{ order_id }] = await sqlRows<{ order_id: string }>(
        m,
        `SELECT order_id FROM it_items WHERE id = $1`,
        [s.id],
      );
      await deriveOrder(m, s.organizationId, order_id);
    },
  };

  const newOrder = async (
    status = 'submitted',
    items = 2,
    itemVersion = itemVersionId,
  ) => {
    const orderId = randomUUID();
    const org = fx.clinicA.organizationId;
    await fx.dataSource.query(
      `INSERT INTO it_orders (id, organization_id, lab_id, workflow_version_id, status) VALUES ($1, $2, $3, $4, $5)`,
      [orderId, org, labId, orderVersionId, status],
    );
    const itemIds: string[] = [];
    for (let i = 0; i < items; i++) {
      const id = randomUUID();
      itemIds.push(id);
      await fx.dataSource.query(
        `INSERT INTO it_items (id, organization_id, order_id, lab_id, workflow_version_id, status) VALUES ($1, $2, $3, $4, $5, 'pending_acceptance')`,
        [id, org, orderId, labId, itemVersion],
      );
    }
    return { orderId, itemIds };
  };

  const status = async (table: string, id: string) =>
    (
      await sqlRows<{ status: string }>(
        fx.dataSource,
        `SELECT status FROM ${table} WHERE id = $1`,
        [id],
      )
    )[0].status;

  const item = (
    id: string,
    action: string,
    actor: TransitionActor,
    extra: {
      input?: Record<string, unknown>;
      reason?: string;
      idempotencyKey?: string;
      expectedVersion?: number;
      onBehalfOfLabId?: string;
    } = {},
  ) =>
    engine.transition({
      organizationId: fx.clinicA.organizationId,
      entityType: 'it_item',
      entityId: id,
      action,
      actor,
      ...extra,
    });

  const errorCode = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return e instanceof EngineException
        ? e.code
        : ((e as { response?: { code?: string } }).response?.code ?? 'OTHER');
    }
    return 'NO_ERROR';
  };

  beforeAll(async () => {
    fx = await createLabsFixture('labs_it_workflow');
    engine = fx.app.get(WorkflowEngine);
    for (const table of ['it_orders', 'it_items']) {
      await fx.dataSource.query(`CREATE TABLE ${table} (
        id uuid PRIMARY KEY,
        organization_id uuid NOT NULL,
        order_id uuid,
        lab_id uuid,
        workflow_version_id uuid NOT NULL,
        status text NOT NULL,
        version int NOT NULL DEFAULT 1)`);
    }
    engine.registerAdapter(orderAdapter);
    engine.registerAdapter(itemAdapter);

    const list = await fx.platform(
      'get',
      '/platform/workflow-templates?owner=platform',
      fx.superAdmin,
    );
    const templates = list.body.data as {
      code: string;
      current: { id: string };
    }[];
    const byCode = (c: string) => templates.find((w) => w.code === c)!;
    orderVersionId = byCode('DENTAL_ORDER').current.id;
    itemVersionId = byCode('DENTAL_ITEM').current.id;
  }, 300_000);

  afterAll(async () => {
    await fx?.close();
  });

  describe('seeds and registry', () => {
    it('boot published the three §9 workflows and three stage templates', async () => {
      const wf = await fx.platform(
        'get',
        '/platform/workflow-templates',
        fx.superAdmin,
      );
      expect(
        wf.body.data.map(
          (w: {
            code: string;
            entityType: string;
            current: { versionNo: number };
          }) => [w.code, w.entityType, w.current.versionNo],
        ),
      ).toEqual([
        ['DENTAL_ITEM', 'item', 1],
        ['DENTAL_ORDER', 'order', 1],
        ['DENTAL_STAGE', 'stage', 1],
      ]);

      const stages = await fx.platform(
        'get',
        '/platform/stage-templates',
        fx.superAdmin,
      );
      const pfm = stages.body.data.find(
        (s: { code: string }) => s.code === 'PFM_3_STAGE',
      );
      expect(
        pfm.steps.map(
          (s: { seq: number; code: string }) => `${s.seq}:${s.code}`,
        ),
      ).toEqual(['1:metal_tryin', '2:bisque_tryin', '3:final']);

      const effects = await fx.platform(
        'get',
        '/platform/workflow-effects',
        fx.superAdmin,
      );
      expect(effects.body.data.map((e: { code: string }) => e.code)).toContain(
        'recompute_order_status',
      );
      expect(await fx.app.get(EngineSeedService).seed()).toBe(0);
    });

    it('a version shows its definition and a test run to every terminal state', async () => {
      const list = await fx.platform(
        'get',
        '/platform/workflow-templates',
        fx.superAdmin,
      );
      const itemWf = list.body.data.find(
        (w: { code: string }) => w.code === 'DENTAL_ITEM',
      );
      const v = await fx.platform(
        'get',
        `/platform/workflow-templates/${itemWf.id}/versions/${itemWf.current.id}`,
        fx.superAdmin,
      );
      expect(v.body.data.issues).toEqual([]);
      const delivered = v.body.data.simulation.find(
        (r: { terminal: string }) => r.terminal === 'delivered',
      );
      expect(delivered.path.length).toBe(8);
    });
  });

  describe('transition()', () => {
    it('moves items and derives the order: one ready + one in production = partially_ready', async () => {
      const { orderId, itemIds } = await newOrder();
      const [a, b] = itemIds;
      const accept = { input: { lab_expected_on: '2026-11-01' } };

      await item(a, 'accept', lab, accept);
      expect(await status('it_orders', orderId)).toBe('submitted');
      await item(b, 'accept', lab, accept);
      expect(await status('it_orders', orderId)).toBe('accepted');

      await item(a, 'start', tech);
      expect(await status('it_orders', orderId)).toBe('in_progress');
      await item(a, 'finish', tech);
      await item(a, 'qc_pass', tech);
      await item(b, 'start', tech);
      expect(await status('it_items', a)).toBe('ready');
      expect(await status('it_orders', orderId)).toBe('partially_ready');

      const orderHistory = await fx.dataSource
        .getRepository(StatusHistory)
        .find({
          where: { entityType: 'it_order', entityId: orderId },
          order: { createdAt: 'ASC', id: 'ASC' },
        });
      expect(
        orderHistory.map((h) => [h.toState, h.actionCode, h.actorSide]),
      ).toEqual([
        ['accepted', 'derive', 'system'],
        ['in_progress', 'derive', 'system'],
        ['partially_ready', 'derive', 'system'],
      ]);

      const itemHistory = await fx.dataSource
        .getRepository(StatusHistory)
        .find({
          where: { entityType: 'it_item', entityId: a },
          order: { createdAt: 'ASC', id: 'ASC' },
        });
      expect(itemHistory[0]).toMatchObject({
        fromState: 'pending_acceptance',
        toState: 'accepted',
        actionCode: 'accept',
        actorSide: 'lab',
        via: 'app',
        metadata: { input: { lab_expected_on: '2026-11-01' } },
      });
    });

    it('rejects invalid transitions with the allowed actions (422)', async () => {
      const { itemIds } = await newOrder('submitted', 1);
      try {
        await item(itemIds[0], 'approve', doctor);
        fail('expected INVALID_TRANSITION');
      } catch (e) {
        expect(e).toBeInstanceOf(EngineException);
        expect((e as EngineException).code).toBe('INVALID_TRANSITION');
        expect((e as EngineException).getStatus()).toBe(422);
        expect((e as EngineException).getResponse()).toMatchObject({
          from: 'pending_acceptance',
          allowedActions: ['accept', 'reject'],
        });
      }
      // Derived changes are never a user action.
      expect(await errorCode(item(itemIds[0], 'derive', system))).toBe(
        'INVALID_TRANSITION',
      );
    });

    it('enforces side, role, required input and reason', async () => {
      const { itemIds } = await newOrder('submitted', 1);
      const id = itemIds[0];
      expect(
        await errorCode(
          item(id, 'accept', doctor, { input: { lab_expected_on: 'x' } }),
        ),
      ).toBe('TRANSITION_FORBIDDEN');
      expect(
        await errorCode(
          item(id, 'accept', tech, { input: { lab_expected_on: 'x' } }),
        ),
      ).toBe('TRANSITION_FORBIDDEN');
      expect(await errorCode(item(id, 'accept', lab))).toBe(
        'TRANSITION_INPUT_REQUIRED',
      );
      expect(await errorCode(item(id, 'reject', lab, { reason: '  ' }))).toBe(
        'TRANSITION_REASON_REQUIRED',
      );
      expect(await status('it_items', id)).toBe('pending_acceptance');
      expect(
        await fx.dataSource
          .getRepository(StatusHistory)
          .countBy({ entityId: id }),
      ).toBe(0);
    });

    it('proxy mode: a clinic admin acts for the case’s lab, recorded as proxy', async () => {
      const { itemIds } = await newOrder('submitted', 1);
      const id = itemIds[0];
      const admin: TransitionActor = {
        userId: fx.clinicA.admin,
        side: 'clinic',
        roles: ['clinic_admin'],
        via: TransitionVia.PROXY,
      };
      expect(
        await errorCode(
          item(id, 'accept', admin, {
            input: { lab_expected_on: 'x' },
            onBehalfOfLabId: randomUUID(),
          }),
        ),
      ).toBe('TRANSITION_FORBIDDEN');
      expect(
        await errorCode(
          item(
            id,
            'accept',
            { ...admin, roles: ['doctor'] },
            { input: { lab_expected_on: 'x' }, onBehalfOfLabId: labId },
          ),
        ),
      ).toBe('TRANSITION_FORBIDDEN');

      await item(id, 'accept', admin, {
        input: { lab_expected_on: '2026-11-02' },
        onBehalfOfLabId: labId,
      });
      const [h] = await fx.dataSource
        .getRepository(StatusHistory)
        .findBy({ entityId: id });
      expect(h).toMatchObject({
        actorSide: 'clinic',
        via: 'proxy',
        onBehalfOfLabId: labId,
        actorUserId: fx.clinicA.admin,
      });
    });

    it('same idempotency key → same result, one change; different request → refused', async () => {
      const { itemIds } = await newOrder('submitted', 1);
      const id = itemIds[0];
      const key = randomUUID();
      const opts = {
        input: { lab_expected_on: '2026-11-03' },
        idempotencyKey: key,
      };
      const first = await item(id, 'accept', lab, opts);
      const again = await item(id, 'accept', lab, opts);
      expect(first.replayed).toBe(false);
      expect(again).toEqual({ ...first, replayed: true });
      expect(
        await fx.dataSource
          .getRepository(StatusHistory)
          .countBy({ entityId: id }),
      ).toBe(1);

      expect(
        await errorCode(item(id, 'start', tech, { idempotencyKey: key })),
      ).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('optimistic lock: a stale expected version is refused', async () => {
      const { itemIds } = await newOrder('submitted', 1);
      const id = itemIds[0];
      const r = await item(id, 'accept', lab, {
        input: { lab_expected_on: 'x' },
        expectedVersion: 1,
      });
      expect(r.version).toBe(2);
      expect(
        await errorCode(item(id, 'start', tech, { expectedVersion: 1 })),
      ).toBe('STALE_VERSION');
    });

    it('hold freezes derivation; resume runs recompute_order_status', async () => {
      const { orderId, itemIds } = await newOrder('submitted', 2);
      const [a, b] = itemIds;
      for (const id of itemIds)
        await item(id, 'accept', lab, { input: { lab_expected_on: 'x' } });
      await item(a, 'start', tech);
      expect(await status('it_orders', orderId)).toBe('in_progress');

      const order = (opts: { action: string; reason?: string }) =>
        engine.transition({
          organizationId: fx.clinicA.organizationId,
          entityType: 'it_order',
          entityId: orderId,
          actor: doctor,
          ...opts,
        });
      await order({ action: 'hold', reason: 'Patient travelling' });
      await item(a, 'finish', tech);
      await item(a, 'qc_pass', tech);
      await item(b, 'start', tech);
      expect(await status('it_orders', orderId)).toBe('on_hold');

      await order({ action: 'resume' });
      expect(await status('it_orders', orderId)).toBe('partially_ready');
      const last = await fx.dataSource.getRepository(StatusHistory).find({
        where: { entityId: orderId },
        order: { createdAt: 'DESC', id: 'DESC' },
        take: 2,
      });
      expect(last.map((h) => [h.actionCode, h.toState])).toEqual([
        ['derive', 'partially_ready'],
        ['resume', 'in_progress'],
      ]);
    });

    it('a failing effect rolls the whole transition back', async () => {
      const registry = fx.app.get(EffectRegistry);
      registry.register({
        code: 'it_explode',
        description: 'test: always fails',
        isFinancial: false,
        run: () => Promise.reject(new Error('boom')),
      });
      await fx.app.get(EngineSeedService).seed(); // syncs workflow_effects

      const specialties = await fx.platform(
        'get',
        '/platform/specialties',
        fx.superAdmin,
      );
      const dentalId = specialties.body.data[0].id;
      const created = await fx.platform(
        'post',
        '/platform/workflow-templates',
        fx.superAdmin,
        {
          specialtyId: dentalId,
          entityType: 'item',
          code: 'IT_EXPLODING',
          name: 'Exploding',
          copyFromVersionId: itemVersionId,
        },
      );
      const tpl = created.body.data;
      const draftUrl = `/platform/workflow-templates/${tpl.id}/versions/${tpl.draft.id}`;
      const draft = (await fx.platform('get', draftUrl, fx.superAdmin)).body
        .data;
      draft.definition.transitions = draft.definition.transitions.map(
        (t: { action: string }) =>
          t.action === 'start'
            ? { ...t, effects: [{ code: 'it_explode' }] }
            : t,
      );
      const saved = await fx.platform('patch', draftUrl, fx.superAdmin, {
        definition: draft.definition,
        version: draft.version,
      });
      expect(saved.body.data.issues).toEqual([]);
      const published = await fx.platform(
        'post',
        `${draftUrl}/publish`,
        fx.superAdmin,
        {
          version: saved.body.data.version,
        },
      );
      expect(published.body.data.status).toBe('published');

      const { itemIds } = await newOrder('submitted', 1, tpl.draft.id);
      const id = itemIds[0];
      await item(id, 'accept', lab, { input: { lab_expected_on: 'x' } });
      await expect(item(id, 'start', tech)).rejects.toThrow('boom');
      expect(await status('it_items', id)).toBe('accepted');
      expect(
        await fx.dataSource
          .getRepository(StatusHistory)
          .countBy({ entityId: id, actionCode: 'start' }),
      ).toBe(0);
    });
  });

  describe('workflow template lifecycle (API)', () => {
    it('invalid drafts save with issues but cannot publish; published versions are frozen', async () => {
      const specialties = await fx.platform(
        'get',
        '/platform/specialties',
        fx.superAdmin,
      );
      const created = await fx.platform(
        'post',
        '/platform/workflow-templates',
        fx.superAdmin,
        {
          specialtyId: specialties.body.data[0].id,
          entityType: 'stage',
          code: 'it_tiny',
          name: 'Tiny',
        },
      );
      expect(created.body.data).toMatchObject({
        code: 'IT_TINY',
        current: null,
      });
      const url = `/platform/workflow-templates/${created.body.data.id}/versions/${created.body.data.draft.id}`;

      const broken = await fx.platform('patch', url, fx.superAdmin, {
        definition: {
          states: [
            { code: 'new', name: 'New', category: 'initial' },
            { code: 'done', name: 'Done', category: 'done' },
          ],
          transitions: [
            {
              from: 'new',
              action: 'finish',
              to: 'done',
              allowedSides: ['lab'],
              allowedRoles: ['wizard'],
            },
          ],
        },
        version: 1,
      });
      expect(
        broken.body.data.issues.map((i: { code: string }) => i.code),
      ).toEqual(['no_cancelled_state', 'unknown_role']);
      const refused = await fx.platform(
        'post',
        `${url}/publish`,
        fx.superAdmin,
        {
          version: broken.body.data.version,
        },
      );
      expect(code(refused)).toBe('WORKFLOW_DEFINITION_INVALID');

      const fixed = await fx.platform('patch', url, fx.superAdmin, {
        definition: {
          states: [
            { code: 'new', name: 'New', category: 'initial' },
            { code: 'done', name: 'Done', category: 'done' },
            { code: 'dropped', name: 'Dropped', category: 'cancelled' },
          ],
          transitions: [
            {
              from: 'new',
              action: 'finish',
              to: 'done',
              allowedSides: ['lab'],
            },
            {
              from: 'new',
              action: 'drop',
              to: 'dropped',
              allowedSides: ['clinic'],
            },
          ],
        },
        version: broken.body.data.version,
      });
      expect(fixed.body.data.issues).toEqual([]);
      const ok = await fx.platform('post', `${url}/publish`, fx.superAdmin, {
        version: fixed.body.data.version,
      });
      expect(ok.body.data.status).toBe('published');

      const frozen = await fx.platform('patch', url, fx.superAdmin, {
        definition: fixed.body.data.definition,
        version: ok.body.data.version,
      });
      expect(code(frozen)).toBe('WORKFLOW_VERSION_NOT_DRAFT');
      const states = await fx.dataSource.query(
        `SELECT code, is_terminal FROM workflow_states WHERE template_version_id = $1 ORDER BY sort_order`,
        [ok.body.data.id],
      );
      expect(states).toEqual([
        { code: 'new', is_terminal: false },
        { code: 'done', is_terminal: true },
        { code: 'dropped', is_terminal: true },
      ]);
    });

    it('is super-admin only', async () => {
      const res = await fx.platform(
        'get',
        '/platform/workflow-templates',
        fx.clinicA.admin,
      );
      expect(res.status).toBe(403);
    });
  });

  describe('stage templates (API)', () => {
    it('replaces steps with optimistic locking and validates them', async () => {
      const list = await fx.platform(
        'get',
        '/platform/stage-templates',
        fx.superAdmin,
      );
      const single = list.body.data.find(
        (s: { code: string }) => s.code === 'SINGLE_STAGE',
      );
      const url = `/platform/stage-templates/${single.id}`;
      const step = (code: string, approval = true) => ({
        code,
        name: code,
        requiresPatientVisit: true,
        requiresDoctorApproval: approval,
        defaultLabDays: 2,
      });

      const dup = await fx.platform('patch', url, fx.superAdmin, {
        steps: [step('a'), step('a')],
        version: single.version,
      });
      expect(code(dup)).toBe('STAGE_TEMPLATE_INVALID');
      const noApproval = await fx.platform('patch', url, fx.superAdmin, {
        steps: [step('a'), step('final', false)],
        version: single.version,
      });
      expect(code(noApproval)).toBe('STAGE_TEMPLATE_INVALID');

      const updated = await fx.platform('patch', url, fx.superAdmin, {
        steps: [step('impression_check'), step('final')],
        version: single.version,
      });
      expect(
        updated.body.data.steps.map((s: { code: string }) => s.code),
      ).toEqual(['impression_check', 'final']);
      expect(updated.body.data.version).toBe(single.version + 1);

      const stale = await fx.platform('patch', url, fx.superAdmin, {
        name: 'x',
        version: single.version,
      });
      expect(code(stale)).toBe('STALE_VERSION');
    });
  });
});
