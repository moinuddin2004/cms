import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Core entities
import { User } from './user/entities/user.entity';
import { Patient } from './patients/entities/patient.entity';
import { PatientVisit } from './patients/entities/patient-visit.entity';
import { PatientDentalInfo } from './patients/entities/patient-dental-info.entity';
import { PatientCommunication } from './patients/entities/patient-communication.entity';
import { PatientConsent } from './patients/entities/patient-consent.entity';
import { PatientDocument } from './patients/entities/patient-document.entity';
import { PatientFeedback } from './patients/entities/patient-feedback.entity';
import { PatientInsurance } from './patients/entities/patient-insurance.entity';
import { PatientPrescription } from './patients/entities/patient-prescription.entity';
import { PatientRecall } from './patients/entities/patient-recall.entity';
import { PatientReferral } from './patients/entities/patient-referral.entity';
import { PatientTeethChart } from './patients/entities/patient-teeth-chart.entity';
import { PatientTreatmentPlan } from './patients/entities/patient-treatment-plan.entity';
import { PatientVitals } from './patients/entities/patient-vitals.entity';
import { TreatmentPlanItem } from './patients/entities/treatment-plan-item.entity';
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
import { EmployeeOrgLocationAssignment } from './employees/entities/employee-org-location-assignment.entity';
import { EmploymentRole } from './employees/entities/employment-role.entity';

// Payroll entities
import { PayrollRecord } from './payroll/entities/payroll-record.entity';

// Domain entities
import { Chair } from './chairs/entities/chair.entity';
import { Appointment } from './appointments/entities/appointment.entity';
import { Inventory } from './inventory/entities/inventory.entity';

// Inventory & Supplies module entities
import { InventoryCategory } from './inventory/entities/inventory-category.entity';
import { InventoryItem } from './inventory/entities/inventory-item.entity';
import { StockMovement } from './inventory/entities/stock-movement.entity';
import { Supplier } from './inventory/entities/supplier.entity';
import { PurchaseOrder } from './inventory/entities/purchase-order.entity';
import { PurchaseOrderItem } from './inventory/entities/purchase-order-item.entity';
import { ConsumptionTemplate } from './inventory/entities/consumption-template.entity';
import { ConsumptionTemplateItem } from './inventory/entities/consumption-template-item.entity';
import { PatientConsumption } from './inventory/entities/patient-consumption.entity';
import { PatientConsumptionItem } from './inventory/entities/patient-consumption-item.entity';

// Billing entities
import { Invoice } from './billing/entities/invoice.entity';
import { InvoiceItem } from './billing/entities/invoice-item.entity';
import { Payment } from './billing/entities/payment.entity';
import { Coupon } from './billing/entities/coupon.entity';
import { Expense } from './billing/entities/expense.entity';
import { CreditPackage } from './billing/entities/credit-package.entity';
import { PatientCredit } from './billing/entities/patient-credit.entity';

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
    PatientDentalInfo,
    PatientCommunication,
    PatientConsent,
    PatientDocument,
    PatientFeedback,
    PatientInsurance,
    PatientPrescription,
    PatientRecall,
    PatientReferral,
    PatientTeethChart,
    PatientTreatmentPlan,
    PatientVitals,
    TreatmentPlanItem,
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
    EmployeeOrgLocationAssignment,
    EmploymentRole,
    // Payroll
    PayrollRecord,
    // Domain
    Chair,
    Appointment,
    Inventory,
    // Inventory & Supplies module
    InventoryCategory,
    InventoryItem,
    StockMovement,
    Supplier,
    PurchaseOrder,
    PurchaseOrderItem,
    ConsumptionTemplate,
    ConsumptionTemplateItem,
    PatientConsumption,
    PatientConsumptionItem,
    // Billing
    Invoice,
    InvoiceItem,
    Payment,
    Coupon,
    Expense,
    CreditPackage,
    PatientCredit,
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
