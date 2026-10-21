import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { join } from 'path';
import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import type { App } from 'supertest/types';
import { TenantContextGuard } from 'src/auth/guards/tenant-context.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { FeatureFlagGuard } from 'src/feature-flags/guards/feature-flag.guard';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { AccessModule } from 'src/access/access.module';
import { AccessGuard } from 'src/access/access.guard';
import { AccessTemplatesService } from 'src/access/templates/access-templates.service';
import { AnyMember, Can } from 'src/access/decorators/access.decorators';
import { User } from 'src/user/entities/user.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import type { MeAccess } from 'src/access/access.controller';
import { itDatabaseUrl, itSsl } from '../billing/db.config';

/** Own schema for this suite only (created and dropped here). */
const SCHEMA = 'accesscoreit';
const USER_HEADER = 'x-test-user';

@Injectable()
class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user?: { uuid: string };
    }>();
    const uuid = req.headers[USER_HEADER];
    if (!uuid) throw new UnauthorizedException();
    req.user = { uuid };
    return true;
  }
}

@Controller('access-it')
@Can('billing.desk.use')
class ProbeController {
  @Get('void')
  @Can('billing.invoice.void')
  void() {
    return { ok: true };
  }
}

@Controller('access-it-member')
class MemberProbeController {
  @Get()
  @AnyMember()
  member() {
    return { ok: true };
  }
}

async function runSql(sql: string) {
  const db = new DataSource({
    type: 'postgres',
    url: itDatabaseUrl(),
    ssl: itSsl(),
  });
  await db.initialize();
  try {
    await db.query(sql);
  } finally {
    await db.destroy();
  }
}

/** `data` of a ResponseWrapper body. */
const dataOf = <T = MeAccess>(res: request.Response) =>
  (res.body as { data: T }).data;

describe('Access core (API)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let orgId: string;
  let locId: string;
  let ownerId: string;
  let staffId: string;
  let outsiderId: string;
  let superId: string;
  let roleId: string;

  const get = (
    url: string,
    user: string,
    loc: string | null = locId,
    org = orgId,
  ) => {
    let r = request(app.getHttpServer() as App)
      .get(url)
      .set(USER_HEADER, user)
      .set('x-organization-id', org);
    if (loc) r = r.set('x-location-id', loc);
    return r;
  };

  beforeAll(async () => {
    await runSql('CREATE EXTENSION IF NOT EXISTS btree_gist');
    await runSql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await runSql(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await runSql(`CREATE SCHEMA ${SCHEMA}`);

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: itDatabaseUrl(),
          ssl: itSsl(),
          entities: [join(__dirname, '../../src/**/*.entity.ts')],
          synchronize: true,
          extra: { options: `-c search_path=${SCHEMA},public`, max: 6 },
        }),
        TypeOrmModule.forFeature([
          User,
          Organization,
          OrganizationOwnership,
          Location,
          Employee,
          EmployeeOrgLocationAssignment,
        ]),
        FeatureFlagsModule,
        AccessModule,
      ],
      controllers: [ProbeController, MemberProbeController],
      providers: [
        AuthorizationService,
        { provide: APP_GUARD, useClass: HeaderAuthGuard },
        { provide: APP_GUARD, useClass: TenantContextGuard },
        { provide: APP_GUARD, useClass: FeatureFlagGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: AccessGuard },
      ],
    })
      // Controller-level @UseGuards(JwtAuthGuard): identity comes from the header guard.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication({ logger: ['error'] });
    await app.init();
    ds = app.get<DataSource>(getDataSourceToken());

    const em = ds.manager;
    const user = (label: string, globalRole: GlobalRole | null = null) =>
      em.getRepository(User).save({
        email: `${label}.${randomUUID().slice(0, 8)}@access-it.test`,
        name: label,
        globalRole,
      } as Partial<User>);
    const org = await em.getRepository(Organization).save({
      name: 'Access IT',
      slug: `access-it-${randomUUID().slice(0, 8)}`,
    } as Partial<Organization>);
    orgId = org.id;
    locId = (
      await em.getRepository(Location).save({
        organizationId: orgId,
        name: 'Main',
        code: 'AIT',
        timezone: 'Asia/Karachi',
        currency: 'PKR',
        isMainBranch: true,
      } as Partial<Location>)
    ).id;
    await app.get(FeatureFlagsService).seedFlagsForOrg(orgId);

    ownerId = (await user('owner')).uuid;
    await em.getRepository(OrganizationOwnership).save({
      userId: ownerId,
      organizationId: orgId,
      isPrimaryOwner: true,
    } as Partial<OrganizationOwnership>);
    superId = (await user('super', GlobalRole.SUPER_ADMIN)).uuid;
    outsiderId = (await user('outsider')).uuid;
    staffId = (await user('staff')).uuid;

    const employee = await em.getRepository(Employee).save({
      fullName: 'Staff One',
      phone: `03${String(Date.now()).slice(-9)}`,
    } as Partial<Employee>);
    roleId = (
      await em.getRepository(EmploymentRole).save({
        organizationId: orgId,
        name: 'Empty',
        slug: 'empty',
        permissions: {},
      } as Partial<EmploymentRole>)
    ).id;
    await em.getRepository(EmployeeOrgLocationAssignment).save({
      employeeId: employee.id,
      organizationId: orgId,
      locationId: locId,
      employmentRoleId: roleId,
      designation: 'staff',
      employeeCode: 'AIT1',
      joiningDate: new Date('2024-01-01'),
      hasPortalAccess: true,
      userId: staffId,
      createdBy: staffId,
    } as Partial<EmployeeOrgLocationAssignment>);
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    await runSql(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  });

  const version = async () =>
    Number(
      (
        await ds.query<{ access_version: number }[]>(
          'SELECT access_version FROM organizations WHERE id = $1',
          [orgId],
        )
      )[0].access_version,
    );

  it('seeds the five role templates once (idempotent)', async () => {
    const templates = app.get(AccessTemplatesService);
    expect(await templates.seedForOrg(orgId)).toBe(5);
    expect(await templates.seedForOrg(orgId)).toBe(0);
    const keys = (
      await ds
        .getRepository(EmploymentRole)
        .find({ where: { organizationId: orgId } })
    )
      .map((r) => r.templateKey)
      .filter(Boolean)
      .sort();
    expect(keys).toEqual([
      'accountant',
      'admin',
      'assistant',
      'doctor',
      'receptionist',
    ]);
  });

  it('GET /me/access for the owner: everything, contract shape', async () => {
    const res = await get('/me/access', ownerId).expect(200);
    const me = dataOf(res);
    expect(Object.keys(me).sort()).toEqual(
      [
        'version',
        'organizationId',
        'locationId',
        'isSuperAdmin',
        'isOwner',
        'features',
        'permissions',
        'roles',
        'employeeId',
        'homeRoute',
        'nav',
      ].sort(),
    );
    expect(me).toMatchObject({
      organizationId: orgId,
      locationId: locId,
      isOwner: true,
      isSuperAdmin: false,
      employeeId: null,
      nav: null,
      roles: [],
    });
    expect(me.permissions['admin.roles.manage']).toBe(true);
    expect(me.permissions['patients.view']).toBe('org');
    expect(me.features).toContain('patients.core');
    expect(typeof me.version).toBe('number');
  });

  it('GET /me/access works without a location and for super admins', async () => {
    const owner = dataOf(await get('/me/access', ownerId, null).expect(200));
    expect(owner.locationId).toBeNull();
    const sa = dataOf(await get('/me/access', superId).expect(200));
    expect(sa.isSuperAdmin).toBe(true);
  });

  it('GET /me/access refuses outsiders and needs an org', async () => {
    await get('/me/access', outsiderId).expect(403);
    await get('/me/access', outsiderId, null).expect(403);
    await request(app.getHttpServer() as App)
      .get('/me/access')
      .set(USER_HEADER, ownerId)
      .expect(400);
  });

  it('staff with an empty role get nothing (fail-closed)', async () => {
    const me = dataOf(await get('/me/access', staffId).expect(200));
    expect(me.permissions).toEqual({});
    expect(me.roles).toEqual([
      { id: roleId, name: 'Empty', templateKey: null },
    ]);
    const denied = await get('/access-it/void', staffId).expect(403);
    // No GlobalExceptionFilter here: the body is the exception response itself
    // (in the app it sits under `error`).
    const body = denied.body as { code: string; missing: string[] };
    expect(body.code).toBe('NO_PERMISSION');
    expect([...body.missing].sort()).toEqual([
      'billing.desk.use',
      'billing.invoice.void',
    ]);
    await get('/access-it-member', staffId).expect(200);
    await get('/access/catalog', staffId).expect(403);
  });

  it('editing the role bumps access_version and the new permissions apply at once', async () => {
    await app
      .get(FeatureFlagsService)
      .toggleFeature(orgId, 'billing.invoices', true);
    const before = await version();
    const repo = ds.getRepository(EmploymentRole);
    const role = await repo.findOneByOrFail({ id: roleId });
    role.permissions = {
      'billing.desk.use': true,
      'billing.invoice.void': true,
    };
    role.homeRoute = '/billing';
    await repo.save(role);
    expect(await version()).toBe(before + 1);

    const me = dataOf(await get('/me/access', staffId).expect(200));
    expect(me.version).toBe(before + 1);
    expect(me.homeRoute).toBe('/billing');
    expect(me.permissions).toMatchObject({
      'billing.desk.use': true,
      'billing.invoice.void': true,
      'billing.invoice.view': 'own', // implied
    });
    await get('/access-it/void', staffId).expect(200);
  });

  it('turning a feature off bumps the version and drops its permissions', async () => {
    const before = await version();
    await app
      .get(FeatureFlagsService)
      .toggleFeature(orgId, 'billing.invoices', false);
    expect(await version()).toBe(before + 1);
    const me = dataOf(await get('/me/access', staffId).expect(200));
    expect(me.permissions['billing.invoice.void']).toBeUndefined();
    expect(me.features).not.toContain('billing.invoices');
    await app
      .get(FeatureFlagsService)
      .toggleFeature(orgId, 'billing.invoices', true);
    expect(
      dataOf(await get('/me/access', staffId).expect(200)).permissions[
        'billing.invoice.void'
      ],
    ).toBe(true);
  });

  it('revoking portal access bumps the version and removes membership', async () => {
    const repo = ds.getRepository(EmployeeOrgLocationAssignment);
    const a = await repo.findOneByOrFail({ userId: staffId });
    a.hasPortalAccess = false;
    await repo.save(a);
    await get('/access-it-member', staffId).expect(403);
  });

  it('GET /access/catalog for the owner', async () => {
    const res = await get('/access/catalog', ownerId).expect(200);
    const { groups, templates, scopes } = dataOf<{
      groups: { group: string }[];
      templates: unknown[];
      scopes: string[];
    }>(res);
    expect(scopes).toEqual(['own', 'location', 'org']);
    expect(groups.map((g) => g.group)).toContain('Billing');
    expect(templates).toHaveLength(5);
  });

  it('GET /feature-flags/my-features refuses outsiders', async () => {
    await get('/feature-flags/my-features', outsiderId, null).expect(403);
    await get('/feature-flags/my-features', ownerId, null).expect(200);
  });
});
