import type { Paginated } from '@/core/types';

/** Shapes of `/patient-api` reads (docs/07 §6, as built in backend `patient-app/reads`). */
export type ClinicStatus = 'active' | 'suspended';

export interface ClinicRef {
  organizationId: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  clinicStatus: ClinicStatus;
}

export interface LocationRef {
  id: string;
  name: string;
  /** IANA zone — every instant of the record is shown on this clock. */
  timezone: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
}

interface RecordBase {
  id: string;
  profileId: string;
  clinic: ClinicRef;
  location: LocationRef;
}

export interface PatientAppointment extends RecordBase {
  doctorName: string | null;
  startTime: string;
  endTime: string;
  status: string;
  type: string;
  patientConfirmedAt: string | null;
  canConfirm: boolean;
}

export interface PatientVisit extends RecordBase {
  /** YYYY-MM-DD on the location's clock. */
  date: string;
  doctorName: string | null;
  followUpDate: string | null;
  /** Absent when the clinic hides diagnoses from the app. */
  diagnosis?: string | null;
  treatments?: string[];
}

export interface PatientPrescription extends RecordBase {
  doctorName: string | null;
  number: string;
  issuedAt: string;
  medicinesCount: number;
  hasPdf: boolean;
}

export interface PrescriptionMedicine {
  name: string;
  nameUrdu: string | null;
  type: string | null;
  dosage: string;
  frequency: string;
  frequencyTiming: string[];
  mealRelation: string;
  duration: string;
  instructions: string | null;
  instructionsUrdu: string | null;
}

export interface PatientPrescriptionDetail extends PatientPrescription {
  medicines: PrescriptionMedicine[];
}

export type InvoiceStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';

export interface PatientInvoice {
  id: string;
  profileId: string;
  number: string;
  issuedAt: string;
  /** IANA zone of the invoice's location. */
  timezone: string;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  status: InvoiceStatus;
}

export interface BillingClinic {
  clinic: ClinicRef;
  currency: string;
  billedMinor: number;
  paidMinor: number;
  balanceMinor: number;
  invoices: PatientInvoice[];
}

/** An invoice with the clinic it belongs to (the bills list is flat). */
export interface BillRow {
  invoice: PatientInvoice;
  clinic: ClinicRef;
  currency: string;
}

export type RecordPage<T> = Paginated<T>;

export type RecordSegment = 'appointments' | 'visits' | 'prescriptions' | 'bills';
