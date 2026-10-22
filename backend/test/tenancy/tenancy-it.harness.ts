import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { join } from 'path';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { TenantContextGuard } from 'src/auth/guards/tenant-context.guard';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { GlobalRole } from 'src/common/enums/global-role.enum';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Employee } from 'src/employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { FeatureFlagGuard } from 'src/feature-flags/guards/feature-flag.guard';
import { Location } from 'src/locations/entities/location.entity';
import { LocationSettings } from 'src/locations/entities/location-settings.entity';
import { LocationsController } from 'src/locations/locations.controller';
import { LocationsService } from 'src/locations/locations.service';
import { AccessModule } from 'src/access/access.module';
import { OrganizationOwnership } from 'src/organizations/entities/organization-ownership.entity';
import { OrganizationSettings } from 'src/organizations/entities/organization-settings.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { OrganizationsController } from 'src/organizations/organizations.controller';
import { OrganizationsService } from 'src/organizations/organizations.service';
import { User } from 'src/user/entities/user.entity';
import { itDatabaseUrl, itSsl } from '../billing/db.config';

/**
 * Own schema (not billing_it), created and dropped by this harness, so this
 * suite never collides with a concurrent billing run. Fixed name on purpose —
 * `DROP SCHEMA … CASCADE` runs against it.
 */
const TENANCY_SCHEMA = 'tenancy_it';

/** API tests identify the caller with this header; the real guards do the rest. */
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

async function runSql(sql: string): Promise<void> {
  const client = new Client({
    connectionString: itDatabaseUrl(),
    ssl: itSsl(),
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

export interface TenancyClinic {
  tenant: TenantContext;
  /** Employee with an active assignment at the clinic — a "normal clinic user". */
  staffUserId: string;
  /** Organization owner (organization_ownership row, no employee record). */
  ownerUserId: string;
}

let phoneSeq = Math.floor(Math.random() * 1e7);

export class TenancyFixture {
  readonly dataSource: DataSource;
  superAdminId!: string;
  clinicA!: TenancyClinic;
  clinicB!: TenancyClinic;

  constructor(readonly app: INestApplication) {
    this.dataSource = app.get<DataSource>(getDataSourceToken());
  }

  async close(): Promise<void> {
    await this.app.close();
    if (!process.env.TENANCY_IT_KEEP_SCHEMA) {
      await runSql(`DROP SCHEMA IF EXISTS ${TENANCY_SCHEMA} CASCADE`);
    }
  }

  private async newUser(
    label: string,
    globalRole: GlobalRole | null = null,
  ): Promise<User> {
    return this.dataSource.getRepository(User).save({
      email: `${label}.${randomUUID().slice(0, 8)}@tenancy-it.test`,
      name: label,
      globalRole,
    } as Partial<User>);
  }

  private async seedClinic(
    label: string,
    code: string,
  ): Promise<TenancyClinic> {
    const em = this.dataSource.manager;
    const org = await em.getRepository(Organization).save({
      name: `Tenancy IT ${label}`,
      slug: `tenancy-it-${label}-${randomUUID().slice(0, 8)}`,
    } as Partial<Organization>);
    const location = await em.getRepository(Location).save({
      organizationId: org.id,
      name: `${label} Main`,
      code,
      timezone: 'Asia/Karachi',
      currency: 'PKR',
      isMainBranch: true,
    } as Partial<Location>);

    const owner = await this.newUser(`owner.${label}`);
    await em.getRepository(OrganizationOwnership).save({
      userId: owner.uuid,
      organizationId: org.id,
      isPrimaryOwner: true,
    } as Partial<OrganizationOwnership>);

    const staff = await this.newUser(`admin.${label}`);
    const employee = await em.getRepository(Employee).save({
      fullName: `admin ${label}`,
      phone: `03${String(phoneSeq++).padStart(9, '0')}`,
    } as Partial<Employee>);
    const role = await em.getRepository(EmploymentRole).save({
      organizationId: org.id,
      name: 'admin',
      slug: 'admin',
      // → clinic_admin + receptionist (legacy @Roles, fail-closed derivation)
      permissions: { 'admin.settings.manage': true, 'appointments.book': true },
    } as Partial<EmploymentRole>);
    await em.getRepository(EmployeeOrgLocationAssignment).save({
      employeeId: employee.id,
      organizationId: org.id,
      locationId: location.id,
      employmentRoleId: role.id,
      designation: 'admin',
      employeeCode: `ADM${phoneSeq}`,
      joiningDate: new Date('2024-01-01'),
      hasPortalAccess: true,
      userId: staff.uuid,
      createdBy: staff.uuid,
    } as Partial<EmployeeOrgLocationAssignment>);

    return {
      tenant: { organizationId: org.id, locationId: location.id },
      staffUserId: staff.uuid,
      ownerUserId: owner.uuid,
    };
  }

  async seed(): Promise<void> {
    this.superAdminId = (
      await this.newUser('super', GlobalRole.SUPER_ADMIN)
    ).uuid;
    this.clinicA = await this.seedClinic('A', 'KHI');
    this.clinicB = await this.seedClinic('B', 'LHR');
  }
}

/**
 * Boots the organizations + locations controllers behind the real global
 * guard chain (TenantContextGuard → FeatureFlagGuard → AccessGuard) on an
 * isolated schema. Only the JWT check is swapped for a header, as in the
 * billing harness.
 */
export async function createTenancyFixture(): Promise<TenancyFixture> {
  // Extensions live database-wide; both are IF NOT EXISTS no-ops on dev DBs.
  await runSql('CREATE EXTENSION IF NOT EXISTS btree_gist');
  await runSql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await runSql(`DROP SCHEMA IF EXISTS ${TENANCY_SCHEMA} CASCADE`);
  await runSql(`CREATE SCHEMA ${TENANCY_SCHEMA}`);

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: itDatabaseUrl(),
        ssl: itSsl(),
        entities: [join(__dirname, '../../src/**/*.entity.ts')],
        synchronize: true,
        extra: { options: `-c search_path=${TENANCY_SCHEMA},public`, max: 6 },
      }),
      TypeOrmModule.forFeature([
        User,
        Organization,
        OrganizationOwnership,
        OrganizationSettings,
        Location,
        LocationSettings,
        Employee,
        EmployeeOrgLocationAssignment,
      ]),
      FeatureFlagsModule,
      // LocationsController checks admin.locations.manage via AccessResolver
      AccessModule,
    ],
    controllers: [OrganizationsController, LocationsController],
    providers: [
      OrganizationsService,
      LocationsService,
      AuthorizationService,
      { provide: APP_GUARD, useClass: HeaderAuthGuard },
      { provide: APP_GUARD, useClass: TenantContextGuard },
      { provide: APP_GUARD, useClass: FeatureFlagGuard },
    ],
  })
    // Controller-level @UseGuards(JwtAuthGuard): identity comes from the header guard.
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication({ logger: ['error'] });
  await app.init();

  const fixture = new TenancyFixture(app);
  await fixture.seed();
  return fixture;
}
