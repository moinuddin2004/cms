/**
 * Response shapes of the patient read API (07 §6). Explicit allow-lists:
 * the mappers in `patient-reads.mappers.ts` build these field by field; no
 * entity or raw row is ever spread into a response.
 */

/** `active` clinics and `suspended` ones (A-19: records stay readable). */
export type ClinicStatus = 'active' | 'suspended';

export interface ClinicRefDto {
  organizationId: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  clinicStatus: ClinicStatus;
}

export interface LocationRefDto {
  id: string;
  name: string;
  timezone: string;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
}

export interface PatientAppointmentDto {
  id: string;
  profileId: string;
  clinic: ClinicRefDto;
  location: LocationRefDto;
  doctorName: string | null;
  startTime: string;
  endTime: string;
  status: string;
  type: string;
  /** When the patient confirmed from the app (M3-08); null = not yet. */
  patientConfirmedAt: string | null;
  /** Future, not cancelled/arrived, link active + app enabled, clinic active. */
  canConfirm: boolean;
}

export interface PatientVisitDto {
  id: string;
  profileId: string;
  clinic: ClinicRefDto;
  location: LocationRefDto;
  /** YYYY-MM-DD on the location's clock. */
  date: string;
  doctorName: string | null;
  followUpDate: string | null;
  /** Present only when the clinic's `patient_app.show_diagnosis` is on. */
  diagnosis?: string | null;
  treatments?: string[];
}

export interface PatientPrescriptionDto {
  id: string;
  profileId: string;
  clinic: ClinicRefDto;
  location: LocationRefDto;
  doctorName: string | null;
  number: string;
  issuedAt: string;
  medicinesCount: number;
  hasPdf: boolean;
}

export interface PatientPrescriptionMedicineDto {
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

export interface PatientPrescriptionDetailDto extends PatientPrescriptionDto {
  medicines: PatientPrescriptionMedicineDto[];
}

export type PatientInvoiceStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';

export interface PatientInvoiceDto {
  id: string;
  profileId: string;
  number: string;
  issuedAt: string;
  /** IANA zone of the invoice's location: show `issuedAt` on this clock. */
  timezone: string;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  status: PatientInvoiceStatus;
}

export interface PatientBillingClinicDto {
  clinic: ClinicRefDto;
  currency: string;
  billedMinor: number;
  paidMinor: number;
  balanceMinor: number;
  invoices: PatientInvoiceDto[];
}

export interface PagedDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
