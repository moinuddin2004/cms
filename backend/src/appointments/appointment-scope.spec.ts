import { AccessContext } from 'src/access/access-context';
import type { Grant, PermissionMap } from 'src/access/catalog/permissions';
import { rowInScope, scopeSql } from './appointment-scope';
import { AppointmentsService } from './appointments.service';
import type { AppointmentFilterDto } from './dto/appointment-filter.dto';

function access(view: Grant | undefined, employeeId: string | null = 'doc1') {
  const permissions: PermissionMap = view ? { 'appointments.view': view } : {};
  return new AccessContext({
    userId: 'u1',
    organizationId: 'org1',
    locationId: 'loc1',
    version: 1,
    isSuperAdmin: false,
    isOwner: false,
    isMember: true,
    employeeId,
    features: ['appointments.core'],
    permissions,
    roles: [],
    homeRoute: null,
  });
}

const cols = { own: 'a.doctor_id', location: 'a.location_id' };

function sqlFor(ctx: AccessContext) {
  const params: unknown[] = ['loc1'];
  const sql = scopeSql(ctx, 'appointments.view', cols, (v) => {
    params.push(v);
    return `$${params.length}`;
  });
  return { sql, params };
}

describe('scopeSql (walk-in list + stats)', () => {
  it('own → the doctor column, as the next $n', () => {
    expect(sqlFor(access('own'))).toEqual({
      sql: 'AND a.doctor_id = $2',
      params: ['loc1', 'doc1'],
    });
  });

  it('location → the location column', () => {
    expect(sqlFor(access('location'))).toEqual({
      sql: 'AND a.location_id = $2',
      params: ['loc1', 'loc1'],
    });
  });

  it('org → no clause', () => {
    expect(sqlFor(access('org'))).toEqual({ sql: '', params: ['loc1'] });
  });

  it('no grant, or own without an employee → no rows', () => {
    expect(sqlFor(access(undefined)).sql).toBe('AND 1 = 0');
    expect(sqlFor(access('own', null)).sql).toBe('AND 1 = 0');
  });
});

describe('rowInScope (appointment detail)', () => {
  const mine = { own: 'doc1', location: 'loc1' };
  const theirs = { own: 'doc2', location: 'loc1' };
  const elsewhere = { own: 'doc2', location: 'loc2' };

  it('own sees only own bookings', () => {
    expect(rowInScope(access('own'), 'appointments.view', mine)).toBe(true);
    expect(rowInScope(access('own'), 'appointments.view', theirs)).toBe(false);
  });

  it('location sees the location', () => {
    const ctx = access('location');
    expect(rowInScope(ctx, 'appointments.view', theirs)).toBe(true);
    expect(rowInScope(ctx, 'appointments.view', elsewhere)).toBe(false);
  });

  it('org sees everything; no grant sees nothing', () => {
    expect(rowInScope(access('org'), 'appointments.view', elsewhere)).toBe(
      true,
    );
    expect(rowInScope(access(undefined), 'appointments.view', mine)).toBe(
      false,
    );
  });
});

describe('AppointmentsService.findAll scope filter', () => {
  function serviceWithQb() {
    const wheres: { sql: string; params?: Record<string, unknown> }[] = [];
    const qb: Record<string, unknown> = {};
    const chain = () => qb;
    Object.assign(qb, {
      leftJoinAndSelect: chain,
      orderBy: chain,
      skip: chain,
      take: chain,
      where: (sql: string, params?: Record<string, unknown>) => {
        wheres.push({ sql, params });
        return qb;
      },
      andWhere: (sql: string, params?: Record<string, unknown>) => {
        wheres.push({ sql, params });
        return qb;
      },
      getManyAndCount: () => Promise.resolve([[], 0]),
    });
    const service = Object.create(
      AppointmentsService.prototype,
    ) as AppointmentsService;
    Object.assign(service, {
      appointmentRepo: { createQueryBuilder: () => qb },
    });
    return { service, wheres };
  }

  const tenant = { organizationId: 'org1', locationId: 'loc1' } as never;
  const filters = {} as AppointmentFilterDto;

  it('a doctor with own scope gets only their own bookings', async () => {
    const { service, wheres } = serviceWithQb();
    await service.findAll(tenant, filters, access('own'));
    const scope = wheres.find((w) => w.sql.startsWith('a.doctor_id'));
    expect(scope).toBeDefined();
    expect(Object.values(scope!.params ?? {})).toEqual(['doc1']);
  });

  it('location scope adds the location filter, org adds nothing', async () => {
    const loc = serviceWithQb();
    await loc.service.findAll(tenant, filters, access('location'));
    // the base location filter plus the scope's own
    expect(
      loc.wheres.filter((w) => w.sql.startsWith('a.location_id =')),
    ).toHaveLength(2);
    expect(loc.wheres.some((w) => w.sql.startsWith('a.doctor_id'))).toBe(false);

    const org = serviceWithQb();
    await org.service.findAll(tenant, filters, access('org'));
    expect(org.wheres.map((w) => w.sql)).toEqual([
      'a.location_id = :locationId',
    ]);
  });
});
