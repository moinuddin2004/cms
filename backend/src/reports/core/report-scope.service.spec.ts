import { ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { AccessContext, AccessContextInit } from 'src/access/access-context';
import type { ClockService } from 'src/common/clock/clock.service';
import { ReportScopeService } from './report-scope.service';
import type { ReportQueryDto } from './report-query.dto';

const ORG = '11111111-1111-4111-8111-111111111111';
const LOC = '22222222-2222-4222-8222-222222222222';
const LOC2 = '33333333-3333-4333-8333-333333333333';
const EMP = '44444444-4444-4444-8444-444444444444';

function access(over: Partial<AccessContextInit> = {}) {
  return new AccessContext({
    userId: 'u1',
    organizationId: ORG,
    locationId: LOC,
    version: 1,
    isSuperAdmin: false,
    isOwner: false,
    isMember: true,
    employeeId: EMP,
    features: [],
    permissions: {},
    roles: [],
    homeRoute: null,
    ...over,
  });
}

function service() {
  const query = jest.fn((_sql: string, params: unknown[]) =>
    Promise.resolve(
      params.length === 1
        ? [
            { id: LOC, name: 'Main', org_name: 'Smile' },
            { id: LOC2, name: 'DHA', org_name: 'Smile' },
          ]
        : [{ id: LOC, name: 'Main', org_name: 'Smile' }],
    ),
  );
  const clock = {
    timezoneFor: jest.fn().mockResolvedValue('Asia/Karachi'),
    today: jest.fn().mockReturnValue('2026-10-22'),
    dayRange: jest.fn((_tz: string, day: string) => ({
      start: new Date(`${day}T00:00:00+05:00`),
    })),
  };
  const svc = new ReportScopeService(
    { query } as unknown as DataSource,
    clock as unknown as ClockService,
  );
  return { svc, query };
}

const tenant = { organizationId: ORG, locationId: LOC };
const whole: Pick<ReportQueryDto, 'scope'> = { scope: 'organization' };
const here: Pick<ReportQueryDto, 'scope'> = {};

async function code(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ForbiddenException);
    return ((e as ForbiddenException).getResponse() as { code: string }).code;
  }
  throw new Error('expected a 403');
}

describe('ReportScopeService.resolve', () => {
  it('runs for every location with an org-wide grant', async () => {
    const { svc } = service();
    const a = access({ permissions: { 'reports.financial.view': 'org' } });
    const scope = await svc.resolve(
      tenant,
      a,
      { perm: 'reports.financial.view' },
      whole,
    );
    expect(scope.wholeOrg).toBe(true);
    expect(scope.locationIds).toEqual([LOC, LOC2]);
    expect(scope.label).toBe('All locations (2)');
    expect(scope.doctorId).toBeUndefined();
  });

  it('refuses all locations to a location-scoped grant', async () => {
    const { svc } = service();
    const a = access({ permissions: { 'reports.clinical.view': 'location' } });
    await expect(
      code(svc.resolve(tenant, a, { perm: 'reports.clinical.view' }, whole)),
    ).resolves.toBe('NO_PERMISSION');
    const scope = await svc.resolve(
      tenant,
      a,
      { perm: 'reports.clinical.view' },
      here,
    );
    expect(scope.wholeOrg).toBe(false);
    expect(scope.locationIds).toEqual([LOC]);
  });

  it('owner status alone does not widen the reach: only the grant does', async () => {
    const { svc } = service();
    const a = access({
      isOwner: true,
      permissions: { 'reports.financial.view': 'location' },
    });
    await expect(
      code(svc.resolve(tenant, a, { perm: 'reports.financial.view' }, whole)),
    ).resolves.toBe('NO_PERMISSION');
  });

  it('narrows an own-scoped grant to the caller as doctor', async () => {
    const { svc } = service();
    const a = access({ permissions: { 'reports.clinical.view': 'own' } });
    const scope = await svc.resolve(
      tenant,
      a,
      { perm: 'reports.clinical.view', doctorFilter: true },
      here,
    );
    expect(scope.doctorId).toBe(EMP);
    // the doctor filter can't be widened from the query
    const params = svc.params(
      scope,
      { doctorId: 'someone-else' } as ReportQueryDto,
      0,
    );
    expect(params.doctorId).toBe(EMP);
  });

  it('refuses an own-scoped grant on reports without a doctor view', async () => {
    const { svc } = service();
    const a = access({ permissions: { 'reports.clinical.view': 'own' } });
    await expect(
      code(svc.resolve(tenant, a, { perm: 'reports.clinical.view' }, here)),
    ).resolves.toBe('NO_PERMISSION');
  });

  it('refuses without the permission at all', async () => {
    const { svc, query } = service();
    await expect(
      code(
        svc.resolve(tenant, access(), { perm: 'reports.financial.view' }, here),
      ),
    ).resolves.toBe('NO_PERMISSION');
    expect(query).not.toHaveBeenCalled();
  });

  it('finance overview: gated by finance.overview.view, reach from reports.financial.view', async () => {
    const { svc } = service();
    const rule = {
      perm: 'finance.overview.view',
      orgPerm: 'reports.financial.view',
    } as const;
    const viewerOnly = access({
      permissions: { 'finance.overview.view': true },
    });
    expect((await svc.resolve(tenant, viewerOnly, rule, here)).wholeOrg).toBe(
      false,
    );
    await expect(
      code(svc.resolve(tenant, viewerOnly, rule, whole)),
    ).resolves.toBe('NO_PERMISSION');

    const orgWide = access({
      permissions: {
        'finance.overview.view': true,
        'reports.financial.view': 'org',
      },
    });
    expect((await svc.resolve(tenant, orgWide, rule, whole)).wholeOrg).toBe(
      true,
    );
  });
});
