import { DynamicModule, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClinicAccessModule } from './clinic-access/clinic-access.module';
import { UserModule } from './user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CloudinaryModule } from './common/cloudinary';
import { StorageModule } from './common/storage/storage.module';
import { APP_GUARD } from '@nestjs/core';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SubscriptionGuard } from './subscriptions/subscription.guard';
import { JwtAuthGuard } from './auth/guards/jwt.guard';
import { TenantContextGuard } from './auth/guards/tenant-context.guard';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionModule } from './session/session.module';
import { BillingModule } from './billing/billing.module';
import { PatientsModule } from './patients/patients.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { LocationsModule } from './locations/locations.module';
import { EmployeesModule } from './employees/employees.module';
import { PayrollModule } from './payroll/payroll.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { EncountersModule } from './encounters/encounters.module';
import { TreatmentsModule } from './treatments/treatments.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { FeatureFlagGuard } from './feature-flags/guards/feature-flag.guard';
import { InventoryModule } from './inventory/inventory.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { PlanTemplatesModule } from './plan-templates/plan-templates.module';
import { TreatmentPlansModule } from './treatment-plans/treatment-plans.module';
import { AuthorizationService } from './auth/services/authorization.service';
import { ClockModule } from './common/clock/clock.module';
import { ensurePostgresExtensions } from './common/database/ensure-extensions';
import {
  MIGRATIONS_GLOB,
  runPendingMigrations,
} from './common/database/migrations';
import { QueueModule } from './queue/queue.module';
import { AuditModule } from './common/audit/audit.module';
import { SequencesModule } from './common/sequences/sequences.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { LabsModule } from './labs/labs.module';
import { EngineModule } from './engine/engine.module';
import { LabCatalogModule } from './lab-catalog/lab-catalog.module';
import { QueueRuntimeModule } from './queue/queue-runtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LabOrdersModule } from './lab-orders/lab-orders.module';
import { LabAccessModule } from './lab-access/lab-access.module';
import { LabProductionModule } from './lab-production/lab-production.module';
import { LabBillingModule } from './lab-billing/lab-billing.module';
import { LabPayablesModule } from './lab-payables/lab-payables.module';
import { ReportsModule } from './reports/reports.module';
import { LabFinanceModule } from './lab-finance/lab-finance.module';
import { NotificationsRuntimeModule } from './notifications/notifications-runtime.module';
import {
  assertRedisForRole,
  ProcessRole,
  runsHttp,
  runsJobs,
} from './common/runtime/process-role';
import { AccessModule } from './access/access.module';
import { AccessGuard } from './access/access.guard';
import { SettingsRegistryModule } from './settings-registry/settings-registry.module';
import { SearchModule } from './search/search.module';

// Entities needed by AuthorizationService (for global guard)
import { User } from './user/entities/user.entity';
import { OrganizationOwnership } from './organizations/entities/organization-ownership.entity';
import { Organization } from './organizations/entities/organization.entity';
import { Location } from './locations/entities/location.entity';
import { Employee } from './employees/entities/employee.entity';
import { EmployeeOrgLocationAssignment } from './employees/entities/employee-org-location-assignment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
    // Core modules
    AuthModule,
    ClinicAccessModule,
    UserModule,
    CloudinaryModule,
    StorageModule,
    SessionModule,
    // Multi-tenant modules
    OrganizationsModule,
    LocationsModule,
    EmployeesModule,
    PayrollModule,
    // Domain modules
    PatientsModule,
    AppointmentsModule,
    QueueModule, // QueueRuntimeModule (gateway / relay / jobs) is added per role
    EncountersModule,
    TreatmentsModule,
    FeatureFlagsModule,
    BillingModule,
    InventoryModule,
    PrescriptionsModule,
    PlanTemplatesModule,
    TreatmentPlansModule,
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
    NotificationsModule, // NotificationsRuntimeModule (sending loop) is added per role
    AccessModule, // permission catalog, AccessResolver, /me/access (global)
    SettingsRegistryModule,
    SearchModule, // global quick search (Ctrl+K)
    SubscriptionsModule, // plans, trial, manual payments, clinic signup + setup
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AuthorizationService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // First: always check JWT
    },
    {
      provide: APP_GUARD,
      useClass: TenantContextGuard, // Then: validate tenant context
    },
    {
      provide: APP_GUARD,
      useClass: FeatureFlagGuard, // Then: enforce @RequireFeature gating
    },
    {
      provide: APP_GUARD,
      useClass: AccessGuard, // Then: enforce @Can / @AnyMember, set request.access
    },
    {
      provide: APP_GUARD,
      useClass: SubscriptionGuard, // Finally: expired subscription = read-only
    },
  ],
})
export class AppModule {
  /**
   * The same module graph for every process; only what differs per role
   * (see ProcessRole) is added here: schema sync/migrations run in HTTP
   * processes only, and scheduled jobs (ScheduleModule — every @Cron /
   * @Interval in the app, not just the queue's) only where jobs run, so a
   * second API instance never runs them twice.
   */
  static forRole(role: ProcessRole): DynamicModule {
    assertRedisForRole(role);
    const ownsSchema = runsHttp(role);
    return {
      module: AppModule,
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => {
            // Extensions synchronize can't create but our constraints need.
            if (ownsSchema) await ensurePostgresExtensions(configService.get<string>('DATABASE_URL'));
            return {
              type: 'postgres' as const,
              url: configService.get<string>('DATABASE_URL'),
              ssl: {
                rejectUnauthorized: false, // Required for Neon's SSL connection
              },
              autoLoadEntities: true,
              synchronize: ownsSchema && configService.get('NODE_ENV') !== 'production',
              // Run below, after synchronize (TypeORM's migrationsRun runs first).
              migrationsRun: false,
              migrations: [MIGRATIONS_GLOB],
            };
          },
          inject: [ConfigService],
          dataSourceFactory: async (options) => {
            const ds = await new DataSource(options!).initialize();
            if (!ownsSchema) return ds;
            try {
              await runPendingMigrations(ds);
            } catch (err) {
              await ds.destroy();
              throw err;
            }
            return ds;
          },
        }),
        ...(runsJobs(role) ? [ScheduleModule.forRoot()] : []),
        QueueRuntimeModule.forRole(role),
        NotificationsRuntimeModule.forRole(role),
      ],
    };
  }
}
