import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryModule } from './common/cloudinary';
import { StorageModule } from './common/storage/storage.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt.guard';
import { TenantContextGuard } from './auth/guards/tenant-context.guard';
import { BullModule } from '@nestjs/bull';
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
import { AuthorizationService } from './auth/services/authorization.service';

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
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        ssl: {
          rejectUnauthorized: false, // Required for Neon's SSL connection
        },
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') !== 'production',
        migrationsRun: true,
        migrations: ['dist/migrations/*.js'],
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      User,
      OrganizationOwnership,
      Organization,
      Location,
      Employee,
      EmployeeOrgLocationAssignment,
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: configService.get('REDIS_URL') || 'redis://localhost:6379',
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: 'submissions' }),
    ScheduleModule.forRoot(),
    // Core modules
    AuthModule,
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
    EncountersModule,
    TreatmentsModule,
    FeatureFlagsModule,
    BillingModule,
    InventoryModule,
    PrescriptionsModule,
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
      useClass: FeatureFlagGuard, // Finally: enforce @RequireFeature gating
    },
  ],
})
export class AppModule {}
