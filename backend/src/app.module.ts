import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CloudinaryModule } from './common/cloudinary';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt.guard';
import { TenantContextGuard } from './auth/guards/tenant-context.guard';
import { BullModule } from '@nestjs/bull';
import { SessionModule } from './session/session.module';
import { PatientsModule } from './patients/patients.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { LocationsModule } from './locations/locations.module';
import { EmployeesModule } from './employees/employees.module';
import { PayrollModule } from './payroll/payroll.module';
import { AppointmentsModule } from './appointments/appointments.module';
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
        synchronize: true,
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
    BullModule.forRoot({
      // @ts-ignore
      redis: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
    }),
    BullModule.registerQueue({ name: 'submissions' }),
    // Core modules
    AuthModule,
    UserModule,
    CloudinaryModule,
    SessionModule,
    // Multi-tenant modules
    OrganizationsModule,
    LocationsModule,
    EmployeesModule,
    PayrollModule,
    // Domain modules
    PatientsModule,
    AppointmentsModule,
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
      useClass: TenantContextGuard, // Then: validate tenant context (replaces RoleAuthGuard)
    },
  ],
})
export class AppModule { }
