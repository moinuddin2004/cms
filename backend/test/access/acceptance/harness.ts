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
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { TenantContextGuard } from 'src/auth/guards/tenant-context.guard';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { GlobalExceptionFilter } from 'src/common/exceptions/HttpExceptionHandler';
import { AppLogger } from 'src/common/services/logger.service';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { FeatureFlagGuard } from 'src/feature-flags/guards/feature-flag.guard';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { AccessModule } from 'src/access/access.module';
import { AccessGuard } from 'src/access/access.guard';
import { AccessTemplatesService } from 'src/access/templates/access-templates.service';
import { AccessVersionService } from 'src/access/version/access-version.service';
import { ClockModule } from 'src/common/clock/clock.module';
import { AuditModule } from 'src/common/audit/audit.module';
import { SequencesModule } from 'src/common/sequences/sequences.module';
import { IdempotencyModule } from 'src/common/idempotency/idempotency.module';
import { AuthModule } from 'src/auth/auth.module';
import { UserModule } from 'src/user/user.module';
import { CloudinaryModule } from 'src/common/cloudinary';
import { StorageModule } from 'src/common/storage/storage.module';
import { SessionModule } from 'src/session/session.module';
import { BillingModule } from 'src/billing/billing.module';
import { PatientsModule } from 'src/patients/patients.module';
import { OrganizationsModule } from 'src/organizations/organizations.module';
import { LocationsModule } from 'src/locations/locations.module';
import { EmployeesModule } from 'src/employees/employees.module';
import { PayrollModule } from 'src/payroll/payroll.module';
import { AppointmentsModule } from 'src/appointments/appointments.module';
import { EncountersModule } from 'src/encounters/encounters.module';
import { TreatmentsModule } from 'src/treatments/treatments.module';
import { InventoryModule } from 'src/inventory/inventory.module';
import { PrescriptionsModule } from 'src/prescriptions/prescriptions.module';
import { PlanTemplatesModule } from 'src/plan-templates/plan-templates.module';
import { QueueModule } from 'src/queue/queue.module';
import { QueueRuntimeModule } from 'src/queue/queue-runtime.module';
import { EngineModule } from 'src/engine/engine.module';
import { LabsModule } from 'src/labs/labs.module';
import { LabCatalogModule } from 'src/lab-catalog/lab-catalog.module';
import { LabOrdersModule } from 'src/lab-orders/lab-orders.module';
import { LabAccessModule } from 'src/lab-access/lab-access.module';
import { LabProductionModule } from 'src/lab-production/lab-production.module';
import { LabBillingModule } from 'src/lab-billing/lab-billing.module';
import { LabPayablesModule } from 'src/lab-payables/lab-payables.module';
import { LabFinanceModule } from 'src/lab-finance/lab-finance.module';
import { ReportsModule } from 'src/reports/reports.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { SettingsRegistryModule } from 'src/settings-registry/settings-registry.module';
import { User } from 'src/user/entities/user.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { Appointment } from 'src/appointments/entities/appointment.entity';
import { QueueSession } from 'src/queue/entities/queue-session.entity';
import { QueueEntry } from 'src/queue/entities/queue-entry.entity';
import { PatientEncounter } from 'src/encounters/entities/patient-encounter.entity';
import {
  EntryStatus,
  QueueType,
  SessionStatus,
} from 'src/queue/enums/queue.enums';
import { itDatabaseUrl, itSsl } from '../../billing/db.config';
import { ACCEPT_SCHEMA } from './schema';

export { ACCEPT_SCHEMA };

/** API tests identify the caller with this header; every other guard is real. */
export const HDR = 'x-test-user';

@Injectable()
class HeaderAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user?: { uuid: string };
    }>();
    const uuid = req.headers[HDR];
    if (uuid) req.user = { uuid };
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    if (!uuid) throw new UnauthorizedException();
    return true;
  }
}

async function pg<T = unknown>(sql: string, params: unknown[] = []) {
  const client = new Client({
    connectionString: itDatabaseUrl(),
    ssl: itSsl(),
  });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

/** True once an earlier spec already built the tables in the schema. */
async function schemaIsBuilt(): Promise<boolean> {
  const rows = await pg<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.tables
      WHERE table_schema = $1 AND table_name IN ('organizations', 'employment_roles', 'audit_logs', 'lab_orders')`,
    [ACCEPT_SCHEMA],
  );
  return Number(rows[0].n) >= 4;
}

/** The Nest application plus helpers. */
export class Env {
  readonly ds: DataSource;
  readonly flags: FeatureFlagsService;
  readonly versions: AccessVersionService;
  readonly templates: AccessTemplatesService;
  world!: World;

  constructor(readonly app: INestApplication) {
    this.ds = app.get<DataSource>(getDataSourceToken());
    this.flags = app.get(FeatureFlagsService);
    this.versions = app.get(AccessVersionService);
    this.templates = app.get(AccessTemplatesService);
  }

  async close() {
    await this.app?.close();
  }

  /** Raw `access_version` of an organization. */
  async version(orgId = this.world.orgA): Promise<number> {
    const r = await this.ds.query<{ access_version: string }[]>(
      'SELECT access_version FROM organizations WHERE id = $1',
      [orgId],
    );
    return Number(r[0].access_version);
  }

  /** Raw SQL changes bypass the entity subscriber: bump like the app would. */
  async bump(orgId = this.world.orgA) {
    await this.versions.bumpQuietly(orgId);
    this.flags.invalidateCache(orgId);
  }

  /**
   * One HTTP call. Defaults to the person's own org/location headers;
   * `org: null` / `loc: null` omit the header.
   */
  call(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    who: Person | null,
    opts: {
      body?: object;
      org?: string | null;
      loc?: string | null;
      headers?: Record<string, string>;
    } = {},
  ) {
    let r = request(this.app.getHttpServer() as App)[method](url);
    if (who) r = r.set(HDR, who.userId);
    const org = opts.org === undefined ? who?.orgId : opts.org;
    const loc = opts.loc === undefined ? who?.locId : opts.loc;
    if (org) r = r.set('x-organization-id', org);
    if (loc) r = r.set('x-location-id', loc);
    for (const [k, v] of Object.entries(opts.headers ?? {})) r = r.set(k, v);
    return opts.body ? r.send(opts.body) : r;
  }

  get = (url: string, who: Person | null, o = {}) =>
    this.call('get', url, who, o);
  post = (url: string, who: Person | null, body?: object, o = {}) =>
    this.call('post', url, who, { ...o, body });
  put = (url: string, who: Person | null, body?: object, o = {}) =>
    this.call('put', url, who, { ...o, body });
  patch = (url: string, who: Person | null, body?: object, o = {}) =>
    this.call('patch', url, who, { ...o, body });
  del = (url: string, who: Person | null, o = {}) =>
    this.call('delete', url, who, o);
}

export interface BootOptions {
  /** Socket.IO gateway (`/realtime`) and a listening HTTP server. */
  realtime?: boolean;
}

/**
 * Boots the real module graph (everything `AppModule` imports, minus Bull and
 * the background-job runtimes) behind the real guard chain on the `acceptit`
 * schema. Only the JWT check is swapped for the `x-test-user` header.
 */
export async function bootApp(opts: BootOptions = {}): Promise<Env> {
  process.env.JWT_ACCESS_SECRET ??= 'acceptance-it-secret';
  const sync = !(await schemaIsBuilt());
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: itDatabaseUrl(),
        ssl: itSsl(),
        entities: [join(__dirname, '../../../src/**/*.entity.ts')],
        synchronize: sync,
        extra: {
          options: `-c search_path=${ACCEPT_SCHEMA},public`,
          max: 10,
        },
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
      AuthModule,
      UserModule,
      CloudinaryModule,
      StorageModule,
      SessionModule,
      OrganizationsModule,
      LocationsModule,
      EmployeesModule,
      PayrollModule,
      PatientsModule,
      AppointmentsModule,
      QueueModule,
      EncountersModule,
      TreatmentsModule,
      FeatureFlagsModule,
      BillingModule,
      InventoryModule,
      PrescriptionsModule,
      PlanTemplatesModule,
      EngineModule,
      LabsModule,
      LabCatalogModule,
      LabOrdersModule,
      LabAccessModule,
      LabProductionModule,
      LabBillingModule,
      LabPayablesModule,
      LabFinanceModule,
      ReportsModule,
      NotificationsModule,
      AccessModule,
      SettingsRegistryModule,
      ...(opts.realtime ? [QueueRuntimeModule.forRole('api')] : []),
    ],
    providers: [
      AuthorizationService,
      { provide: APP_GUARD, useClass: HeaderAuthGuard },
      { provide: APP_GUARD, useClass: TenantContextGuard },
      { provide: APP_GUARD, useClass: FeatureFlagGuard },
      { provide: APP_GUARD, useClass: AccessGuard },
    ],
  })
    // Controller-level @UseGuards(JwtAuthGuard): identity comes from the header guard.
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication({ logger: ['error'] });
  // Same options as src/bootstrap/http.ts.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(
    new GlobalExceptionFilter({
      info: () => undefined,
      warn: () => undefined,
      debug: () => undefined,
      error: () => undefined,
    } as unknown as AppLogger),
  );
  await app.init();
  if (opts.realtime) await app.listen(0);
  return new Env(app);
}

// ───────────────────────────── Fixtures (section 0) ─────────────────────────

export interface Person {
  /** Login user id (what the `x-test-user` header carries). */
  userId: string;
  employeeId: string | null;
  assignmentId: string | null;
  orgId: string;
  locId: string;
}

export type PersonName =
  | 'SA'
  | 'OwnerA'
  | 'OwnerB'
  | 'AdminU'
  | 'Doc1'
  | 'Doc2'
  | 'RecU'
  | 'AsstU'
  | 'AcctU'
  | 'NoRoleU'
  | 'LegacyU'
  | 'NoPortalU'
  | 'MultiU'
  | 'Outsider';

export interface World {
  orgA: string;
  orgB: string;
  L1: string;
  L2: string;
  LB1: string;
  /** Template role ids of OrgA. */
  roles: Record<'admin' | 'doctor' | 'receptionist' | 'assistant' | 'accountant', string>;
  legacyRoleId: string;
  people: Record<PersonName, Person>;
  /** P1: appointment with Doc1 · P2: encounter with Doc2 · P3: at L2 · PB: OrgB. */
  patients: { P1: string; P2: string; P3: string; PB: string };
  /** Doc1's and Doc2's queue-entry ids behind their encounters. */
  encounters: { doc1: string; doc2: string };
  /** Pass `locId` when you need MultiU at L2. */
  multiAtL2: Person;
}

let seq = Math.floor(Math.random() * 1e6);
const nextPhone = () => `03${String(seq++).padStart(9, '0')}`;

/**
 * Seeds section 0. Every spec file builds its OWN world (new organizations in
 * the shared `acceptit` schema), so mutating cases never disturb each other.
 */
export async function seedWorld(env: Env, label = 'w'): Promise<World> {
  const { ds } = env;
  const em = ds.manager;
  const tag = `${label}${randomUUID().slice(0, 6)}`;

  const newUser = (name: string, globalRole: GlobalRole | null = null) =>
    em.getRepository(User).save({
      email: `${name.toLowerCase()}.${tag}@acceptance-it.test`,
      name,
      globalRole,
    } as Partial<User>);

  const mkOrg = async (name: string, code: string) => {
    const org = await em.getRepository(Organization).save({
      name: `${name} ${tag}`,
      slug: `acc-${name.toLowerCase()}-${tag}`,
    } as Partial<Organization>);
    const mk = (n: string, c: string, main: boolean) =>
      em.getRepository(Location).save({
        organizationId: org.id,
        name: n,
        code: c,
        timezone: 'Asia/Karachi',
        currency: 'PKR',
        isMainBranch: main,
      } as Partial<Location>);
    return { org, mk, code };
  };

  const a = await mkOrg('OrgA', 'A');
  const L1 = await a.mk('A Main', `A1${tag}`.slice(0, 10), true);
  const L2 = await a.mk('A Branch', `A2${tag}`.slice(0, 10), false);
  const b = await mkOrg('OrgB', 'B');
  const LB1 = await b.mk('B Main', `B1${tag}`.slice(0, 10), true);

  await env.flags.seedFlagsForOrg(a.org.id);
  await env.flags.seedFlagsForOrg(b.org.id);
  // "Unless a case says otherwise, all feature flags in OrgA are entitled + enabled."
  for (const orgId of [a.org.id, b.org.id]) {
    await ds.query(
      'UPDATE org_feature_flags SET is_entitled = true, is_enabled = true, entitled_until = NULL WHERE organization_id = $1',
      [orgId],
    );
    env.flags.invalidateCache(orgId);
  }

  await env.templates.seedForOrg(a.org.id);
  await env.templates.seedForOrg(b.org.id);
  const rolesRows = await ds
    .getRepository(EmploymentRole)
    .find({ where: { organizationId: a.org.id } });
  const roleOf = (k: string) => rolesRows.find((r) => r.templateKey === k)!.id;
  const roles = {
    admin: roleOf('admin'),
    doctor: roleOf('doctor'),
    receptionist: roleOf('receptionist'),
    assistant: roleOf('assistant'),
    accountant: roleOf('accountant'),
  };
  const legacyRole = await ds.getRepository(EmploymentRole).save({
    organizationId: a.org.id,
    name: 'Legacy',
    slug: 'legacy',
    isSystemRole: false,
    permissions: { canManageSettings: true, canConsult: true },
  } as Partial<EmploymentRole>);

  const mkPerson = async (
    name: PersonName,
    spec: {
      roleId?: string | null;
      locId?: string;
      orgId?: string;
      portal?: boolean;
      globalRole?: GlobalRole | null;
      employee?: boolean;
    } = {},
  ): Promise<Person> => {
    const user = await newUser(name, spec.globalRole ?? null);
    const orgId = spec.orgId ?? a.org.id;
    const locId = spec.locId ?? L1.id;
    if (spec.employee === false) {
      return {
        userId: user.uuid,
        employeeId: null,
        assignmentId: null,
        orgId,
        locId,
      };
    }
    const employee = await em.getRepository(Employee).save({
      fullName: `${name} ${tag}`,
      phone: nextPhone(),
    } as Partial<Employee>);
    const assignment = await em
      .getRepository(EmployeeOrgLocationAssignment)
      .save({
        employeeId: employee.id,
        organizationId: orgId,
        locationId: locId,
        employmentRoleId: spec.roleId ?? null,
        designation: name,
        employeeCode: `${name.slice(0, 4).toUpperCase()}${seq++}`,
        joiningDate: new Date('2024-01-01'),
        hasPortalAccess: spec.portal ?? true,
        userId: user.uuid,
        createdBy: user.uuid,
      } as Partial<EmployeeOrgLocationAssignment>);
    return {
      userId: user.uuid,
      employeeId: employee.id,
      assignmentId: assignment.id,
      orgId,
      locId,
    };
  };

  const people = {} as Record<PersonName, Person>;
  people.SA = await mkPerson('SA', {
    employee: false,
    globalRole: GlobalRole.SUPER_ADMIN,
  });
  people.Outsider = await mkPerson('Outsider', { employee: false });

  people.OwnerA = await mkPerson('OwnerA', { employee: false });
  await em.getRepository(OrganizationOwnership).save({
    userId: people.OwnerA.userId,
    organizationId: a.org.id,
    isPrimaryOwner: true,
  } as Partial<OrganizationOwnership>);
  people.OwnerB = await mkPerson('OwnerB', {
    employee: false,
    orgId: b.org.id,
    locId: LB1.id,
  });
  await em.getRepository(OrganizationOwnership).save({
    userId: people.OwnerB.userId,
    organizationId: b.org.id,
    isPrimaryOwner: true,
  } as Partial<OrganizationOwnership>);

  people.AdminU = await mkPerson('AdminU', { roleId: roles.admin });
  people.Doc1 = await mkPerson('Doc1', { roleId: roles.doctor });
  people.Doc2 = await mkPerson('Doc2', { roleId: roles.doctor });
  people.RecU = await mkPerson('RecU', { roleId: roles.receptionist });
  people.AsstU = await mkPerson('AsstU', { roleId: roles.assistant });
  people.AcctU = await mkPerson('AcctU', { roleId: roles.accountant });
  people.NoRoleU = await mkPerson('NoRoleU', { roleId: null });
  people.LegacyU = await mkPerson('LegacyU', { roleId: legacyRole.id });
  people.NoPortalU = await mkPerson('NoPortalU', {
    roleId: roles.doctor,
    portal: false,
  });
  people.MultiU = await mkPerson('MultiU', { roleId: roles.receptionist });
  // MultiU is a Doctor at L2 as well (same employee, same login).
  const multiAssign = await em.getRepository(EmployeeOrgLocationAssignment).save({
    employeeId: people.MultiU.employeeId,
    organizationId: a.org.id,
    locationId: L2.id,
    employmentRoleId: roles.doctor,
    designation: 'MultiU doctor',
    employeeCode: `MULT${seq++}`,
    joiningDate: new Date('2024-01-01'),
    hasPortalAccess: true,
    userId: people.MultiU.userId,
    createdBy: people.MultiU.userId,
  } as Partial<EmployeeOrgLocationAssignment>);
  const multiAtL2: Person = {
    ...people.MultiU,
    assignmentId: multiAssign.id,
    locId: L2.id,
  };

  // ── Patients ──────────────────────────────────────────────────────────
  const patient = (orgId: string, locId: string, name: string) =>
    em.getRepository(Patient).save({
      organizationId: orgId,
      primaryLocationId: locId,
      patientNumber: `P${Date.now() % 1e8}${seq++}`.slice(0, 20),
      fullName: `${name} ${tag}`,
      phone: nextPhone(),
    } as Partial<Patient>);
  const P1 = await patient(a.org.id, L1.id, 'Patient One');
  const P2 = await patient(a.org.id, L1.id, 'Patient Two');
  const P3 = await patient(a.org.id, L2.id, 'Patient Three');
  const PB = await patient(b.org.id, LB1.id, 'Patient B');

  // P1: an appointment with Doc1.
  const start = new Date(Date.now() + 24 * 3600 * 1000);
  await em.getRepository(Appointment).save({
    organizationId: a.org.id,
    locationId: L1.id,
    patientId: P1.id,
    doctorId: people.Doc1.employeeId!,
    startTime: start,
    endTime: new Date(start.getTime() + 30 * 60 * 1000),
    durationMinutes: 30,
  } as Partial<Appointment>);

  // A queue visit with an encounter (Doc2 → P2; Doc1 → a walk-in of P1).
  const today = new Date().toISOString().slice(0, 10);
  const encounterFor = async (doc: Person, patientId: string, prefix: string) => {
    const session = await em.getRepository(QueueSession).save({
      organizationId: a.org.id,
      locationId: L1.id,
      doctorId: doc.employeeId!,
      serviceDate: today,
      status: SessionStatus.OPEN,
      tokenPrefix: prefix,
      smartQueueEnabled: false,
    } as Partial<QueueSession>);
    const now = new Date();
    const entry = await em.getRepository(QueueEntry).save({
      organizationId: a.org.id,
      queueSessionId: session.id,
      patientId,
      tokenNumber: 1,
      queueType: QueueType.WALK_IN,
      status: EntryStatus.IN_CONSULTATION,
      checkedInAt: now,
      sortAnchorAt: now,
    } as Partial<QueueEntry>);
    await em.getRepository(PatientEncounter).save({
      queueEntryId: entry.id,
      patientId,
      organizationId: a.org.id,
      locationId: L1.id,
      encounterDate: now,
    } as Partial<PatientEncounter>);
    return entry.id;
  };
  const enc2 = await encounterFor(people.Doc2, P2.id, 'B');
  const enc1 = await encounterFor(people.Doc1, P1.id, 'A');

  // Roles/assignments written above already bumped the version; make sure no
  // stale AccessContext from a half-seeded org is cached.
  env.flags.invalidateCache(a.org.id);

  const world: World = {
    orgA: a.org.id,
    orgB: b.org.id,
    L1: L1.id,
    L2: L2.id,
    LB1: LB1.id,
    roles,
    legacyRoleId: legacyRole.id,
    people,
    patients: { P1: P1.id, P2: P2.id, P3: P3.id, PB: PB.id },
    encounters: { doc1: enc1, doc2: enc2 },
    multiAtL2,
  };
  env.world = world;
  return world;
}

/** `data` of a ResponseWrapper body. */
export const dataOf = <T = unknown>(res: request.Response): T =>
  (res.body as { data: T }).data;

/** `error` of the global exception filter body (`{ code, missing, … }`). */
export const errorOf = (res: request.Response) =>
  (res.body as { error?: Record<string, unknown> }).error ?? {};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ad-hoc staff member of OrgA with a role holding exactly `permissions`
 * (a custom, non-system role). Returns the person and the role id.
 */
export async function addStaff(
  env: Env,
  name: string,
  permissions: Record<string, unknown>,
  opts: { locId?: string; roleId?: string; roleName?: string } = {},
): Promise<{ person: Person; roleId: string }> {
  const w = env.world;
  const em = env.ds.manager;
  const tag = randomUUID().slice(0, 6);
  const locId = opts.locId ?? w.L1;
  let roleId = opts.roleId;
  if (!roleId) {
    const roleName = opts.roleName ?? `${name} role ${tag}`;
    roleId = (
      await em.getRepository(EmploymentRole).save({
        organizationId: w.orgA,
        name: roleName,
        slug: `${name.toLowerCase()}_${tag}`,
        isSystemRole: false,
        permissions,
      } as Partial<EmploymentRole>)
    ).id;
  }
  const user = await em.getRepository(User).save({
    email: `${name.toLowerCase()}.${tag}@acceptance-it.test`,
    name,
  } as Partial<User>);
  const employee = await em.getRepository(Employee).save({
    fullName: `${name} ${tag}`,
    phone: nextPhone(),
  } as Partial<Employee>);
  const assignment = await em
    .getRepository(EmployeeOrgLocationAssignment)
    .save({
      employeeId: employee.id,
      organizationId: w.orgA,
      locationId: locId,
      employmentRoleId: roleId,
      designation: name,
      employeeCode: `${name.slice(0, 3).toUpperCase()}${seq++}`,
      joiningDate: new Date('2024-01-01'),
      hasPortalAccess: true,
      userId: user.uuid,
      createdBy: user.uuid,
    } as Partial<EmployeeOrgLocationAssignment>);
  return {
    person: {
      userId: user.uuid,
      employeeId: employee.id,
      assignmentId: assignment.id,
      orgId: w.orgA,
      locId,
    },
    roleId,
  };
}

/** Appends a per-case note (collected into docs/access-control/test-results.md). */
export function note(id: string, text: string): void {
  const file = process.env.ACCEPT_NOTES_FILE;
  if (!file) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('fs') as typeof import('fs')).appendFileSync(
    file,
    JSON.stringify({ id, text }) + '\n',
  );
}

/** A signed access token for routes behind passport's `AuthGuard('jwt')` (user admin). */
export function bearer(who: Person, globalRole: string | null = null): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { sign } = require('jsonwebtoken') as typeof import('jsonwebtoken');
  return `Bearer ${sign(
    { sub: who.userId, email: `${who.userId}@acceptance-it.test`, globalRole },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '1h' },
  )}`;
}
