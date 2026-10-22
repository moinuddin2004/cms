import type { DataSource } from 'typeorm';
import { AccessContext } from 'src/access/access-context';
import type { PermissionMap } from 'src/access/catalog/permissions';
import { TransitionVia } from 'src/common/audit/audit.enums';
import { AppRole } from 'src/common/enums/app-role.enum';
import type { CompiledTransition } from 'src/engine/runtime/compiled-workflow';
import type { TransitionRequest } from 'src/engine/runtime/runtime.types';
import { WorkflowEngine } from 'src/engine/runtime/workflow-engine.service';
import { OrderTemplatesService } from 'src/lab-catalog/templates/order-templates.service';
import { clinicActorOf } from 'src/labs/common/clinic-actor';
import { LabOrdersService } from '../services/lab-orders.service';
import { ordersAsDoctor } from '../services/order-drafts.service';
import type { ClinicCall } from './order-context';
import { canSeeOrder, scopeOrders } from './order-scope';

const ORG = '11111111-1111-1111-1111-111111111111';
const LOC = '22222222-2222-2222-2222-222222222222';
const OTHER_LOC = '33333333-3333-3333-3333-333333333333';
const USER = '44444444-4444-4444-4444-444444444444';
const EMP = '55555555-5555-5555-5555-555555555555';
const LAB = '66666666-6666-6666-6666-666666666666';

function access(
  permissions: PermissionMap,
  opts: { employeeId?: string | null; isOwner?: boolean } = {},
) {
  return new AccessContext({
    userId: USER,
    organizationId: ORG,
    locationId: LOC,
    version: 1,
    isSuperAdmin: false,
    isOwner: opts.isOwner ?? false,
    isMember: true,
    employeeId: opts.employeeId === undefined ? EMP : opts.employeeId,
    features: ['dental.lab_orders'],
    permissions,
    roles: [],
    homeRoute: null,
  });
}

const call = (perms: PermissionMap, employeeId?: string | null): ClinicCall =>
  ({
    tenant: { organizationId: ORG, locationId: LOC },
    actor: clinicActorOf(access(perms, { employeeId })),
    ref: { userId: USER, side: 'clinic' },
  }) as unknown as ClinicCall;

describe('clinicActorOf', () => {
  it('derives legacy roles from permissions', () => {
    expect(
      clinicActorOf(access({ 'consultation.conduct': 'own' })).roles,
    ).toEqual([AppRole.DOCTOR]);
    expect(clinicActorOf(access({ 'lab.orders.view': 'org' })).roles).toEqual(
      [],
    );
  });

  it('gives owners every role', () => {
    expect(clinicActorOf(access({}, { isOwner: true })).roles).toEqual([
      AppRole.CLINIC_ADMIN,
      AppRole.RECEPTIONIST,
      AppRole.DOCTOR,
    ]);
  });
});

describe('OrderTemplatesService — sharing needs lab.templates.share', () => {
  const transaction = jest.fn().mockResolvedValue('saved');
  const service = new OrderTemplatesService(
    { transaction } as unknown as DataSource,
    {} as never,
    {} as never,
  );
  const dto = { name: 'Crown', items: [], shared: true } as never;
  const ref = { userId: USER, side: 'clinic' } as never;

  beforeEach(() => transaction.mockClear());

  it('refuses a shared template without the permission', async () => {
    const actor = clinicActorOf(access({ 'lab.orders.create': true }));
    await expect(service.create(ORG, actor, ref, dto)).rejects.toMatchObject({
      response: { code: 'ORDER_TEMPLATE_FORBIDDEN' },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('allows it with the permission (no admin role needed)', async () => {
    const actor = clinicActorOf(
      access({ 'lab.orders.create': true, 'lab.templates.share': true }),
    );
    expect(actor.roles).not.toContain(AppRole.CLINIC_ADMIN);
    await expect(service.create(ORG, actor, ref, dto)).resolves.toBe('saved');
  });
});

describe('ordersAsDoctor — a new order defaults its doctor to the caller', () => {
  it('needs consultation.conduct and an employee id', () => {
    expect(ordersAsDoctor(call({ 'consultation.conduct': 'own' }))).toBe(true);
    expect(ordersAsDoctor(call({ 'lab.orders.create': true }))).toBe(false);
    expect(ordersAsDoctor(call({ 'consultation.conduct': 'own' }, null))).toBe(
      false,
    );
  });
});

describe('LabOrdersService.decideCharge — needs lab.orders.create', () => {
  const transaction = jest.fn().mockResolvedValue(undefined);
  const service = Object.assign(
    Object.create(LabOrdersService.prototype) as object,
    { dataSource: { transaction } },
  ) as unknown as LabOrdersService;
  const dto = { decision: 'approve', version: 1 } as never;

  beforeEach(() => transaction.mockClear());

  it('refuses a viewer', async () => {
    await expect(
      service.decideCharge(call({ 'lab.orders.view': 'org' }), 'o', 'c', dto),
    ).rejects.toMatchObject({ response: { code: 'LAB_ORDER_FORBIDDEN' } });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('lets an orderer decide', async () => {
    await service.decideCharge(
      call({ 'lab.orders.create': true }),
      'o',
      'c',
      dto,
    );
    expect(transaction).toHaveBeenCalled();
  });
});

describe('WorkflowEngine proxy check — lab.orders.create + lab.links.manage', () => {
  const engine = Object.create(WorkflowEngine.prototype) as {
    authorize(
      req: TransitionRequest,
      t: CompiledTransition,
      subject: { labId?: string },
    ): string;
  };
  const t = {
    action: 'accept',
    allowedSides: ['lab'],
    allowedRoles: ['lab_admin'],
  } as unknown as CompiledTransition;
  const proxyReq = (perms: PermissionMap): TransitionRequest => {
    const a = access(perms);
    return {
      organizationId: ORG,
      entityType: 'lab_order',
      entityId: 'o',
      action: 'accept',
      onBehalfOfLabId: LAB,
      actor: {
        userId: USER,
        side: 'clinic',
        // An admin role name alone no longer passes.
        roles: [AppRole.CLINIC_ADMIN],
        can: (p) => a.can(p),
        via: TransitionVia.PROXY,
      },
    };
  };

  it('acts as the lab with both permissions', () => {
    expect(
      engine.authorize(
        proxyReq({ 'lab.orders.create': true, 'lab.links.manage': true }),
        t,
        { labId: LAB },
      ),
    ).toBe('lab');
  });

  it('refuses without lab.links.manage, even for a clinic_admin role', () => {
    expect(() =>
      engine.authorize(proxyReq({ 'lab.orders.create': true }), t, {
        labId: LAB,
      }),
    ).toThrow();
  });

  it('refuses a caller without a permission check', () => {
    const req = proxyReq({
      'lab.orders.create': true,
      'lab.links.manage': true,
    });
    delete req.actor.can;
    expect(() => engine.authorize(req, t, { labId: LAB })).toThrow();
  });
});

describe('lab.orders.view scope', () => {
  const order = (o: {
    doctorId?: string | null;
    createdBy?: string | null;
    locationId?: string;
  }) => ({
    doctorId: o.doctorId ?? null,
    createdBy: o.createdBy ?? null,
    locationId: o.locationId ?? LOC,
  });
  const actor = (perms: PermissionMap, employeeId?: string | null) =>
    clinicActorOf(access(perms, { employeeId }));

  it('own: the ordering doctor or the creator', () => {
    const a = actor({ 'lab.orders.view': 'own' });
    expect(canSeeOrder(a, order({ doctorId: EMP }))).toBe(true);
    expect(canSeeOrder(a, order({ createdBy: USER }))).toBe(true);
    expect(canSeeOrder(a, order({ doctorId: 'someone-else' }))).toBe(false);
  });

  it('location: this location only', () => {
    const a = actor({ 'lab.orders.view': 'location' });
    expect(canSeeOrder(a, order({}))).toBe(true);
    expect(canSeeOrder(a, order({ locationId: OTHER_LOC }))).toBe(false);
  });

  it('org: everything; none: nothing', () => {
    expect(
      canSeeOrder(
        actor({ 'lab.orders.view': 'org' }),
        order({ locationId: OTHER_LOC }),
      ),
    ).toBe(true);
    expect(canSeeOrder(actor({}), order({ doctorId: EMP }))).toBe(false);
  });

  it('filters the list query the same way', () => {
    const where: string[] = [];
    const qb = {
      andWhere: (w: unknown) => {
        where.push(typeof w === 'string' ? w : 'brackets');
        return qb;
      },
    };
    scopeOrders(qb as never, actor({ 'lab.orders.view': 'location' }));
    scopeOrders(qb as never, actor({ 'lab.orders.view': 'org' }));
    scopeOrders(qb as never, actor({}));
    scopeOrders(qb as never, actor({ 'lab.orders.view': 'own' }));
    expect(where).toEqual([
      expect.stringMatching(/^o\.location_id = :access_scope_\d+$/),
      '1 = 0',
      'brackets',
    ]);
  });
});
