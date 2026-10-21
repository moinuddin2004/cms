import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { join } from 'path';
import {
  CanActivate,
  DynamicModule,
  ExecutionContext,
  INestApplication,
  Injectable,
  Type,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { TenantContextGuard } from 'src/auth/guards/tenant-context.guard';
import { AuditModule } from 'src/common/audit/audit.module';
import { ClockModule } from 'src/common/clock/clock.module';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { SequencesModule } from 'src/common/sequences/sequences.module';
import { IdempotencyModule } from 'src/common/idempotency/idempotency.module';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { EngineModule } from 'src/engine/engine.module';
import { FeatureFlagGuard } from 'src/feature-flags/guards/feature-flag.guard';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { LAB_FEATURE } from 'src/labs/labs.constants';
import { LabsModule } from 'src/labs/labs.module';
import { Location } from 'src/locations/entities/location.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { User } from 'src/user/entities/user.entity';
import { UUID_V7_FUNCTION_SQL } from 'src/common/database/uuid-v7';
import { itDatabaseUrl, itSsl } from '../billing/db.config';

/** API tests identify the caller with this header; the real guards do the rest. */
const TEST_USER_HEADER = 'x-test-user';

@Injectable()
class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user?: { uuid: string };
    }>();
    const uuid = req.headers[TEST_USER_HEADER];
    if (!uuid) throw new UnauthorizedException();
    req.user = { uuid };
    return true;
  }
}

export interface Clinic {
  organizationId: string;
  locationId: string;
  /** Organization owner → every clinic role. */
  admin: string;
  /** Employee with only the doctor role. */
  doctor: string;
}

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

let seq = Math.floor(Math.random() * 1e7);

export class LabsFixture {
  readonly dataSource: DataSource;
  readonly flags: FeatureFlagsService;

  superAdmin!: string;
  /** Feature enabled. */
  clinicA!: Clinic;
  /** Feature enabled — the "other tenant". */
  clinicB!: Clinic;
  /** Feature disabled. */
  clinicOff!: Clinic;

  constructor(
    readonly app: INestApplication,
    /** This suite's own schema (dropped on close). */
    readonly schema: string,
  ) {
    this.dataSource = app.get<DataSource>(getDataSourceToken());
    this.flags = app.get(FeatureFlagsService);
  }

  async close(): Promise<void> {
    await this.app.close();
    if (!process.env.LABS_IT_KEEP_SCHEMA)
      await runAdmin(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`);
  }

  /** Platform route (no tenant headers). */
  platform(method: Method, url: string, as: string, body?: object) {
    return request(this.app.getHttpServer())
      [method](url)
      .set(TEST_USER_HEADER, as)
      .send(body);
  }

  /** Clinic route as `as`, with `clinic`'s tenant headers. */
  clinic(
    method: Method,
    url: string,
    clinic: Clinic,
    as: string,
    body?: object,
  ) {
    return request(this.app.getHttpServer())
      [method](url)
      .set(TEST_USER_HEADER, as)
      .set('x-organization-id', clinic.organizationId)
      .set('x-location-id', clinic.locationId)
      .send(body);
  }

  async newUser(
    label: string,
    opts: { superAdmin?: boolean } = {},
  ): Promise<{ id: string; email: string }> {
    const email = `${label}.${randomUUID().slice(0, 8)}@labs-it.test`;
    const user = await this.dataSource.getRepository(User).save({
      email,
      name: label,
      globalRole: opts.superAdmin ? GlobalRole.SUPER_ADMIN : null,
    } as Partial<User>);
    return { id: user.uuid, email };
  }

  async seed(): Promise<void> {
    this.superAdmin = (await this.newUser('platform', { superAdmin: true })).id;
    this.clinicA = await this.seedClinic('A', true);
    this.clinicB = await this.seedClinic('B', true);
    this.clinicOff = await this.seedClinic('Off', false);
  }

  private async seedClinic(label: string, enabled: boolean): Promise<Clinic> {
    const em = this.dataSource.manager;
    const org = await em.getRepository(Organization).save({
      name: `Labs IT ${label}`,
      slug: `labs-it-${label.toLowerCase()}-${randomUUID().slice(0, 8)}`,
    } as Partial<Organization>);
    const location = await em.getRepository(Location).save({
      organizationId: org.id,
      name: `${label} Main`,
      code: `L${label.slice(0, 2).toUpperCase()}`,
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      isMainBranch: true,
    } as Partial<Location>);

    const admin = await this.newUser(`admin-${label}`);
    await em.getRepository(OrganizationOwnership).save({
      userId: admin.id,
      organizationId: org.id,
      isPrimaryOwner: true,
    } as Partial<OrganizationOwnership>);

    const doctor = await this.newUser(`doctor-${label}`);
    const employee = await em.getRepository(Employee).save({
      fullName: `Doctor ${label}`,
      phone: `03${String(seq++).padStart(9, '0')}`,
    } as Partial<Employee>);
    const role = await em.getRepository(EmploymentRole).save({
      organizationId: org.id,
      name: 'Doctor',
      slug: 'doctor',
      permissions: {
        'consultation.conduct': 'own', // → doctor (legacy @Roles)
        canManageSettings: false,
        canCreateAppointments: false,
        canConsult: true,
      },
    } as Partial<EmploymentRole>);
    await em.getRepository(EmployeeOrgLocationAssignment).save({
      employeeId: employee.id,
      organizationId: org.id,
      locationId: location.id,
      employmentRoleId: role.id,
      designation: 'Doctor',
      employeeCode: `DOC${seq++}`,
      joiningDate: new Date('2024-01-01'),
      hasPortalAccess: true,
      userId: doctor.id,
      createdBy: admin.id,
    } as Partial<EmployeeOrgLocationAssignment>);

    await this.flags.seedFlagsForOrg(org.id);
    await this.flags.toggleFeature(org.id, LAB_FEATURE, enabled);
    return {
      organizationId: org.id,
      locationId: location.id,
      admin: admin.id,
      doctor: doctor.id,
    };
  }
}

async function runAdmin(...sql: string[]): Promise<void> {
  const ds = await new DataSource({
    type: 'postgres',
    url: itDatabaseUrl(),
    ssl: itSsl(),
    entities: [],
  }).initialize();
  try {
    for (const statement of sql) await ds.query(statement);
  } finally {
    await ds.destroy();
  }
}

/**
 * Boots the labs module + real guards and seeds three clinics, in a schema
 * of the suite's own (`labs_it_*`): never `public`, and never the shared
 * `billing_it`, so a billing run in parallel cannot drop it mid-test.
 */
export async function createLabsFixture(
  schema: string,
  /** Extra modules a suite needs on top of labs + engine (e.g. later sprints). */
  extraImports: Array<Type<unknown> | DynamicModule> = [],
): Promise<LabsFixture> {
  if (!/^labs_it_[a-z0-9_]+$/.test(schema))
    throw new Error(`Bad IT schema ${schema}`);
  await runAdmin(
    'CREATE EXTENSION IF NOT EXISTS btree_gist',
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    UUID_V7_FUNCTION_SQL,
    `DROP SCHEMA IF EXISTS ${schema} CASCADE`,
    `CREATE SCHEMA ${schema}`,
  );
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: itDatabaseUrl(),
        ssl: itSsl(),
        entities: [join(__dirname, '../../src/**/*.entity.ts')],
        synchronize: true,
        extra: { options: `-c search_path=${schema},public`, max: 12 },
      }),
      TypeOrmModule.forFeature([
        User,
        OrganizationOwnership,
        Organization,
        Location,
        Employee,
        EmployeeOrgLocationAssignment,
      ]),
      ClockModule,
      AuditModule,
      SequencesModule,
      IdempotencyModule,
      FeatureFlagsModule,
      EngineModule,
      LabsModule,
      ...extraImports,
    ],
    providers: [
      AuthorizationService,
      { provide: APP_GUARD, useClass: HeaderAuthGuard },
      { provide: APP_GUARD, useClass: TenantContextGuard },
      { provide: APP_GUARD, useClass: FeatureFlagGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: ['error'] });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  const fixture = new LabsFixture(app, schema);
  await fixture.seed();
  return fixture;
}
