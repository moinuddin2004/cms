import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { join } from 'path';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  ValidationPipe,
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
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { AccessModule } from 'src/access/access.module';
import { AccessGuard } from 'src/access/access.guard';
import { AuditModule } from 'src/common/audit/audit.module';
import { AuditLog } from 'src/common/audit/entities/audit-log.entity';
import { User } from 'src/user/entities/user.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import type { MeAccess } from 'src/access/access.controller';
import type { NavLayoutView } from 'src/access/nav/nav-layouts.service';
import { itDatabaseUrl, itSsl } from '../billing/db.config';

/** Own schema for this suite only (created and dropped here). */
const SCHEMA = 'navlayoutsit';
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

const dataOf = <T>(res: request.Response) => (res.body as { data: T }).data;

const LAYOUT = {
  sections: [
    { items: [{ key: 'nav.dashboard' }] },
    {
      label: 'Front desk',
      items: [
        { key: 'nav.billing.desk', label: 'Cash counter' },
        {
          label: 'Records',
          group: true,
          icon: 'Folder',
          items: [{ key: 'nav.patients' }],
        },
      ],
    },
  ],
  hidden: ['nav.payroll'],
};

describe('Nav layouts (API)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let orgId: string;
  let locId: string;
  let ownerId: string;
  let staffId: string;

  const call = (method: 'get' | 'put' | 'delete', url: string, user: string) =>
    request(app.getHttpServer() as App)
      [method](url)
      .set(USER_HEADER, user)
      .set('x-organization-id', orgId)
      .set('x-location-id', locId);

  const version = async () =>
    Number(
      (
        await ds.query<{ access_version: number }[]>(
          'SELECT access_version FROM organizations WHERE id = $1',
          [orgId],
        )
      )[0].access_version,
    );

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
        AuditModule,
        FeatureFlagsModule,
        AccessModule,
      ],
      providers: [
        AuthorizationService,
        { provide: APP_GUARD, useClass: HeaderAuthGuard },
        { provide: APP_GUARD, useClass: TenantContextGuard },
        { provide: APP_GUARD, useClass: AccessGuard },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication({ logger: ['error'] });
    // Same options as src/bootstrap/http.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    ds = app.get<DataSource>(getDataSourceToken());

    const em = ds.manager;
    const user = (label: string) =>
      em.getRepository(User).save({
        email: `${label}.${randomUUID().slice(0, 8)}@nav-it.test`,
        name: label,
      } as Partial<User>);
    orgId = (
      await em.getRepository(Organization).save({
        name: 'Nav IT',
        slug: `nav-it-${randomUUID().slice(0, 8)}`,
      } as Partial<Organization>)
    ).id;
    locId = (
      await em.getRepository(Location).save({
        organizationId: orgId,
        name: 'Main',
        code: 'NIT',
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

    staffId = (await user('staff')).uuid;
    const employee = await em.getRepository(Employee).save({
      fullName: 'Nav Staff',
      phone: `03${String(Date.now()).slice(-9)}`,
    } as Partial<Employee>);
    const role = await em.getRepository(EmploymentRole).save({
      organizationId: orgId,
      name: 'Front desk',
      slug: 'front-desk',
      permissions: { 'patients.view': 'location' },
    } as Partial<EmploymentRole>);
    await em.getRepository(EmployeeOrgLocationAssignment).save({
      employeeId: employee.id,
      organizationId: orgId,
      locationId: locId,
      employmentRoleId: role.id,
      designation: 'staff',
      employeeCode: 'NIT1',
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

  it('starts on the code default: GET is null, /me/access nav is null', async () => {
    const res = await call('get', '/admin/navigation', ownerId).expect(200);
    expect(dataOf(res)).toBeNull();
    const me = dataOf<MeAccess>(
      await call('get', '/me/access', ownerId).expect(200),
    );
    expect(me.nav).toBeNull();
  });

  it('needs admin.nav.manage', async () => {
    await call('get', '/admin/navigation', staffId).expect(403);
    await call('put', '/admin/navigation', staffId).send(LAYOUT).expect(403);
    await call('delete', '/admin/navigation', staffId).expect(403);
  });

  it.each([
    ['a bad key', { sections: [{ items: [{ key: 'Patients' }] }] }],
    [
      'a duplicate key',
      {
        sections: [
          { items: [{ key: 'nav.patients' }] },
          { items: [{ key: 'nav.patients' }] },
        ],
      },
    ],
    [
      'a label over 40 chars',
      { sections: [{ label: 'x'.repeat(41), items: [] }] },
    ],
    [
      'more than 20 sections',
      { sections: Array.from({ length: 21 }, () => ({ items: [] })) },
    ],
  ])('PUT rejects %s with 400', async (_name, body) => {
    await call('put', '/admin/navigation', ownerId).send(body).expect(400);
    expect(
      dataOf(await call('get', '/admin/navigation', ownerId).expect(200)),
    ).toBeNull();
  });

  it('PUT saves, audits, bumps access_version, and /me/access serves it to everyone', async () => {
    const before = await version();
    const saved = dataOf<NavLayoutView>(
      await call('put', '/admin/navigation', ownerId).send(LAYOUT).expect(200),
    );
    expect(saved.layout).toEqual(LAYOUT);
    expect(saved.version).toBe(1);
    expect(saved.updatedBy).toBe(ownerId);
    expect(await version()).toBe(before + 1);

    // Saving the same layout again is not a change.
    await call('put', '/admin/navigation', ownerId).send(LAYOUT).expect(200);
    expect(await version()).toBe(before + 1);

    const audits = await ds.getRepository(AuditLog).find({
      where: { organizationId: orgId, entityType: 'nav_layout' },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].actorUserId).toBe(ownerId);

    // Staff can't edit it but get it with their access (it grants nothing).
    const me = dataOf<MeAccess>(
      await call('get', '/me/access', staffId).expect(200),
    );
    expect(me.nav).toEqual(LAYOUT);
    expect(me.version).toBe(before + 1);
    expect(me.permissions['billing.desk.use']).toBeUndefined();
  });

  it('PUT again updates the same row', async () => {
    const next = { ...LAYOUT, hidden: [], homeRoute: '/patients' };
    const saved = dataOf<NavLayoutView>(
      await call('put', '/admin/navigation', ownerId).send(next).expect(200),
    );
    expect(saved.version).toBe(2);
    expect(saved.layout).toEqual(next);
    expect(
      await ds.query('SELECT id FROM nav_layouts WHERE organization_id = $1', [
        orgId,
      ]),
    ).toHaveLength(1);
  });

  it('DELETE resets to the code default', async () => {
    const before = await version();
    await call('delete', '/admin/navigation', ownerId).expect(200);
    expect(await version()).toBe(before + 1);
    expect(
      dataOf(await call('get', '/admin/navigation', ownerId).expect(200)),
    ).toBeNull();
    expect(
      dataOf<MeAccess>(await call('get', '/me/access', ownerId).expect(200))
        .nav,
    ).toBeNull();
    // Nothing left to reset: no bump.
    await call('delete', '/admin/navigation', ownerId).expect(200);
    expect(await version()).toBe(before + 1);
  });
});
