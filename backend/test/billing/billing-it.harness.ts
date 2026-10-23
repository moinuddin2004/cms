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
import { DataSource } from 'typeorm';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { TenantContextGuard } from 'src/auth/guards/tenant-context.guard';
import { ClockService } from 'src/common/clock/clock.service';
import { ClockModule } from 'src/common/clock/clock.module';
import { AuditModule } from 'src/common/audit/audit.module';
import { AccessContext } from 'src/access/access-context';
import { AccessGuard } from 'src/access/access.guard';
import { AccessModule } from 'src/access/access.module';
import {
  expandImplies,
  normalizeGrants,
  PermissionMap,
} from 'src/access/catalog/permissions';
import { ROLE_TEMPLATES } from 'src/access/catalog/templates';
import { SettingsRegistryModule } from 'src/settings-registry/settings-registry.module';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { FeatureFlagGuard } from 'src/feature-flags/guards/feature-flag.guard';
import { FeatureFlagsService } from 'src/feature-flags/feature-flags.service';
import { Location } from 'src/locations/entities/location.entity';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { User } from 'src/user/entities/user.entity';
import { TreatmentsModule } from 'src/treatments/treatments.module';
import { BillingModule } from 'src/billing/billing.module';
import { BILLING_FEATURE } from 'src/billing/billing.constants';
import {
  billingContext,
  BillingContext,
} from 'src/billing/common/billing-context';
import { BillingInvariantChecker } from 'src/billing/invariants/billing-invariant-checker';
import { CashCloseService } from 'src/billing/cash-close/cash-close.service';
import { CatalogServicesService } from 'src/billing/catalog/catalog.service';
import { ChargeSourcesService } from 'src/billing/charges/charge-sources.service';
import { ChargesService } from 'src/billing/charges/charges.service';
import { DiscountTypesService } from 'src/billing/discounts/discount-types.service';
import { InvoicesService } from 'src/billing/invoices/invoices.service';
import { PatientBillingService } from 'src/billing/patient-billing/patient-billing.service';
import { PaymentAccountsService } from 'src/billing/payment-accounts/payment-accounts.service';
import { PaymentsService } from 'src/billing/payments/payments.service';
import { RefundsService } from 'src/billing/refunds/refunds.service';
import { BillingSettingsService } from 'src/billing/settings/billing-settings.service';
import { CollectPaymentDto } from 'src/billing/dto/payment.dto';
import { ChargeResponse } from 'src/billing/mappers/billing-response.types';
import { AllocationMode } from 'src/billing/enums/billing.enums';
import { IT_SCHEMA, itDatabaseUrl, itSsl } from './db.config';

/** API tests identify the caller with this header; guards do the rest. */
export const TEST_USER_HEADER = 'x-test-user';

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

export type Who = 'admin' | 'reception' | 'doctor';

export interface Person {
  userId: string;
  employeeId: string;
}

export interface Clinic {
  tenant: TenantContext;
  locationCode: string;
  people: Record<Who, Person>;
  cashAccountId: string;
}

const template = (key: string): PermissionMap =>
  ROLE_TEMPLATES.find((t) => t.key === key)!.permissions;

/**
 * Stored role permissions (new format only). Admin and doctor are the system
 * templates; reception is the old receptionist's billing reach (everything
 * but custom discounts, price overrides, settings and reports).
 */
const ROLE_PERMISSIONS: Record<Who, PermissionMap> = {
  admin: template('admin'),
  reception: {
    'appointments.book': true,
    'billing.desk.use': true,
    'billing.invoice.view': 'location',
    'billing.invoice.edit': true,
    'billing.invoice.void': true,
    'billing.payment.collect': true,
    'billing.refund.issue': true,
    'billing.cash_close': true,
    'billing.discount.apply': true,
    'expenses.manage': true,
  },
  doctor: template('doctor'),
};

/** AccessContext for a fixture person (features are not filtered here). */
export function accessFor(
  tenant: TenantContext,
  person: Pick<Person, 'userId' | 'employeeId'>,
  permissions: PermissionMap,
  label = 'test',
): AccessContext {
  return new AccessContext({
    userId: person.userId,
    organizationId: tenant.organizationId,
    locationId: tenant.locationId,
    version: 0,
    isSuperAdmin: false,
    isOwner: false,
    isMember: true,
    employeeId: person.employeeId,
    features: [],
    permissions: expandImplies(normalizeGrants(permissions)),
    roles: [{ id: label, name: label, templateKey: label }],
    homeRoute: null,
  });
}

let phoneSeq = Math.floor(Math.random() * 1e7);
let patientSeq = 0;

export class BillingFixture {
  readonly dataSource: DataSource;
  readonly clock: ClockService;
  readonly charges: ChargesService;
  readonly invoices: InvoicesService;
  readonly payments: PaymentsService;
  readonly refunds: RefundsService;
  readonly settings: BillingSettingsService;
  readonly catalog: CatalogServicesService;
  readonly discountTypes: DiscountTypesService;
  readonly accounts: PaymentAccountsService;
  readonly cashClose: CashCloseService;
  readonly patientBilling: PatientBillingService;
  readonly sources: ChargeSourcesService;
  readonly checker: BillingInvariantChecker;
  readonly flags: FeatureFlagsService;

  /** Two clinics of two organizations: A is the one under test, B is the "other tenant". */
  clinicA!: Clinic;
  clinicB!: Clinic;

  constructor(readonly app: INestApplication) {
    this.dataSource = app.get<DataSource>(getDataSourceToken());
    this.clock = app.get(ClockService);
    this.charges = app.get(ChargesService);
    this.invoices = app.get(InvoicesService);
    this.payments = app.get(PaymentsService);
    this.refunds = app.get(RefundsService);
    this.settings = app.get(BillingSettingsService);
    this.catalog = app.get(CatalogServicesService);
    this.discountTypes = app.get(DiscountTypesService);
    this.accounts = app.get(PaymentAccountsService);
    this.cashClose = app.get(CashCloseService);
    this.patientBilling = app.get(PatientBillingService);
    this.sources = app.get(ChargeSourcesService);
    this.checker = app.get(BillingInvariantChecker);
    this.flags = app.get(FeatureFlagsService);
  }

  async close(): Promise<void> {
    jest.restoreAllMocks();
    await this.app.close();
  }

  ctx(clinic: Clinic, who: Who = 'reception'): BillingContext {
    const access = accessFor(
      clinic.tenant,
      clinic.people[who],
      ROLE_PERMISSIONS[who],
      who,
    );
    return billingContext(clinic.tenant, access);
  }

  /** Pins "now" for the clinic clock (ClockService.now is what BillingClock reads). */
  setNow(at: Date | string): void {
    jest.spyOn(this.clock, 'now').mockReturnValue(new Date(at));
  }

  resetNow(): void {
    jest.spyOn(this.clock, 'now').mockImplementation(() => new Date());
  }

  async newPatient(clinic: Clinic, name = 'Test Patient'): Promise<string> {
    const n = ++patientSeq;
    const row = await this.dataSource.getRepository(Patient).save({
      organizationId: clinic.tenant.organizationId,
      primaryLocationId: clinic.tenant.locationId,
      patientNumber: `P${Date.now() % 1e8}${n}`.slice(0, 20),
      fullName: `${name} ${n}`,
      phone: `03${String(phoneSeq++).padStart(9, '0')}`,
    } as Partial<Patient>);
    return row.id;
  }

  /** An unbilled "Other" charge (reception may price these, D5). */
  async addCharge(
    clinic: Clinic,
    patientId: string,
    c: {
      description: string;
      unitPrice: number;
      chargeDate?: string;
      quantity?: number;
      doctorId?: string;
    },
    who: Who = 'reception',
  ): Promise<ChargeResponse> {
    return this.charges.addManual(this.ctx(clinic, who), patientId, c);
  }

  /** `POST /payments` with sensible defaults (AUTO, cash, advance applied). */
  collectDto(
    clinic: Clinic,
    patientId: string,
    over: Partial<CollectPaymentDto> & { amount: number },
  ): CollectPaymentDto {
    return {
      patientId,
      paymentAccountId: clinic.cashAccountId,
      applyAdvance: true,
      mode: AllocationMode.AUTO,
      selections: [],
      clientRequestId: randomUUID(),
      ...over,
    };
  }

  async collect(
    clinic: Clinic,
    patientId: string,
    over: Partial<CollectPaymentDto> & { amount: number },
    who: Who = 'reception',
  ) {
    return this.payments.collect(
      this.ctx(clinic, who),
      this.collectDto(clinic, patientId, over),
    );
  }

  /** Runs I1–I9 and returns the violations (tests assert it is empty). */
  async violations(clinic: Clinic, patientId: string): Promise<string[]> {
    const rows = await this.checker.checkPatient(
      this.dataSource.manager,
      clinic.tenant,
      patientId,
    );
    return rows.map((v) => `${v.invariant}: ${v.message}`);
  }

  private async seedClinic(label: string, code: string): Promise<Clinic> {
    const em = this.dataSource.manager;
    const org = await em.getRepository(Organization).save({
      name: `Billing IT ${label}`,
      slug: `billing-it-${label}-${randomUUID().slice(0, 8)}`,
    } as Partial<Organization>);
    const location = await em.getRepository(Location).save({
      organizationId: org.id,
      name: `${label} Main`,
      code,
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      isMainBranch: true,
    } as Partial<Location>);

    const people = {} as Record<Who, Person>;
    for (const who of ['admin', 'reception', 'doctor'] as Who[]) {
      const user = await em.getRepository(User).save({
        email: `${who}.${label}.${randomUUID().slice(0, 8)}@billing-it.test`,
        name: `${who} ${label}`,
      } as Partial<User>);
      const employee = await em.getRepository(Employee).save({
        fullName: `${who} ${label}`,
        phone: `03${String(phoneSeq++).padStart(9, '0')}`,
      } as Partial<Employee>);
      const role = await em.getRepository(EmploymentRole).save({
        organizationId: org.id,
        name: who,
        slug: who,
        permissions: ROLE_PERMISSIONS[who],
      } as Partial<EmploymentRole>);
      await em.getRepository(EmployeeOrgLocationAssignment).save({
        employeeId: employee.id,
        organizationId: org.id,
        locationId: location.id,
        employmentRoleId: role.id,
        designation: who,
        employeeCode: who.slice(0, 3).toUpperCase() + phoneSeq,
        joiningDate: new Date('2024-01-01'),
        hasPortalAccess: true,
        userId: user.uuid,
        createdBy: user.uuid,
      } as Partial<EmployeeOrgLocationAssignment>);
      people[who] = {
        userId: user.uuid,
        employeeId: employee.id,
      };
    }

    await this.flags.seedFlagsForOrg(org.id);
    await this.flags.toggleFeature(org.id, BILLING_FEATURE, true);

    const tenant: TenantContext = {
      organizationId: org.id,
      locationId: location.id,
    };
    const settings = await this.dataSource.transaction((m) =>
      this.settings.getOrCreate(m, tenant),
    );
    return {
      tenant,
      locationCode: code,
      people,
      cashAccountId: settings.defaultPaymentAccountId as string,
    };
  }

  async seed(): Promise<void> {
    this.clinicA = await this.seedClinic('A', 'KHI');
    this.clinicB = await this.seedClinic('B', 'LHR');
  }
}

/** Boots the billing module + real guards on the isolated schema and seeds two clinics. */
export async function createBillingFixture(): Promise<BillingFixture> {
  process.env.JWT_ACCESS_SECRET ??= 'billing-it-secret';
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: itDatabaseUrl(),
        ssl: itSsl(),
        entities: [join(__dirname, '../../src/**/*.entity.ts')],
        // Same as dev: the schema is built from the entities. The schema is
        // billing_it only — search_path never reaches `public` tables
        // (public is listed only so the btree_gist / uuid-ossp operators resolve).
        synchronize: true,
        extra: { options: `-c search_path=${IT_SCHEMA},public`, max: 12 },
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
      FeatureFlagsModule,
      AccessModule,
      // PrintDataService reads print branding from the settings registry.
      AuditModule,
      SettingsRegistryModule,
      BillingModule,
      TreatmentsModule,
    ],
    providers: [
      AuthorizationService,
      { provide: APP_GUARD, useClass: HeaderAuthGuard },
      { provide: APP_GUARD, useClass: TenantContextGuard },
      { provide: APP_GUARD, useClass: FeatureFlagGuard },
      { provide: APP_GUARD, useClass: AccessGuard },
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

  const fixture = new BillingFixture(app);
  await fixture.seed();
  return fixture;
}
