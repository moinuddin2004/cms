import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Core entities
import { User } from './user/entities/user.entity';
import { Patient } from './patients/entities/patient.entity';
import { PatientVisit } from './patients/entities/patient-visit.entity';
import { UserSession } from './session/entities/user-session.entity';
import { SecurityLog } from './auth/entities/SecurityLog';

// Organization & Location entities
import { Organization } from './organizations/entities/organization.entity';
import { OrganizationOwnership } from './organizations/entities/organization-ownership.entity';
import { OrganizationSettings } from './organizations/entities/organization-settings.entity';
import { Location } from './locations/entities/location.entity';
import { LocationSettings } from './locations/entities/location-settings.entity';

// Employee entities
import { Employee } from './employees/entities/employee.entity';
import { EmployeeSchedule } from './employees/entities/employee-schedule.entity';
import { EmployeeLocationAssignment } from './employees/entities/employee-location-assignment.entity';
import { EmploymentRole } from './employees/entities/employment-role.entity';

// Domain entities
import { Chair } from './chairs/entities/chair.entity';
import { Appointment } from './appointments/entities/appointment.entity';
import { Inventory } from './inventory/entities/inventory.entity';
import { Invoice } from './invoices/entities/invoice.entity';

// Audit entities

// Load environment variables
config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon')
    ? { rejectUnauthorized: false }
    : false,
  synchronize: true,
  logging: true,
  entities: [
    // Core
    User,
    Patient,
    PatientVisit,
    UserSession,
    SecurityLog,
    // Organization & Location
    Organization,
    OrganizationOwnership,
    OrganizationSettings,
    Location,
    LocationSettings,
    // Employee
    Employee,
    EmployeeSchedule,
    EmployeeLocationAssignment,
    EmploymentRole,
    // Domain
    Chair,
    Appointment,
    Inventory,
    Invoice,
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
