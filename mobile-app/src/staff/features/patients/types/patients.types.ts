import type { Paginated } from '@/core/types';

/** Mirrors backend enums (`patients/enums/*`) as string unions. */
export type Gender = 'male' | 'female' | 'other';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type PatientSource =
  | 'walk_in'
  | 'referral'
  | 'online'
  | 'social_media'
  | 'google'
  | 'other';

/**
 * `PatientResponseDto` (backend `patients/dto/response/patient-response.dto.ts`) —
 * the list and detail endpoints return the same shape. Dates: `dob` is a plain
 * `YYYY-MM-DD`; `createdAt` / `updatedAt` are UTC instants.
 */
export interface PatientDetail {
  id: string;
  patientNumber: string;
  organizationId: string;
  fullName: string;
  phone: string;
  dob: string | null;
  gender: Gender | null;
  bloodGroup: BloodGroup | null;
  maritalStatus: string | null;
  occupation: string | null;
  cnic: string | null;
  whatsappNumber: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  preferredLanguage: string;
  communicationPref: string;
  primaryLocationId: string | null;
  source: PatientSource;
  referredByText: string | null;
  profilePictureUrl: string | null;
  isMinor: boolean;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianRelation: string | null;
  medicalHistory: string | null;
  allergies: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  internalNotes: string | null;
  tags: string[];
  isActive: boolean;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  userId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A list row is the full DTO; screens read the subset they need. */
export type PatientListItem = PatientDetail;

export type PatientSortBy = 'createdAt' | 'fullName' | 'patientNumber';
export type SortOrder = 'ASC' | 'DESC';

/** `GET /patients` query (`PatientQueryDto`). `limit` ≤ 100. */
export interface PatientQuery {
  page?: number;
  limit?: number;
  search?: string;
  gender?: Gender;
  bloodGroup?: BloodGroup;
  source?: PatientSource;
  city?: string;
  tag?: string;
  isActive?: boolean;
  /**
   * `true` only. The backend reads these with `@Type(() => Boolean)`, so the
   * query string `"false"` becomes `true`; to not filter, omit the key.
   */
  isBlacklisted?: true;
  /** `true` only � see `isBlacklisted`. */
  isMinor?: true;
  sortBy?: PatientSortBy;
  sortOrder?: SortOrder;
}

export type PatientPage = Paginated<PatientListItem>;

/** `POST /patients` body (`CreatePatientDto`) — the fields mobile can send. */
export interface CreatePatientInput {
  fullName: string;
  phone: string;
  dob?: string;
  gender?: Gender;
  bloodGroup?: BloodGroup;
  isMinor?: boolean;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
  allergies?: string;
  medicalHistory?: string;
  whatsappNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  source?: PatientSource;
}

/** `GET /patients/check-phone/:phone`. */
export interface CheckPhoneResult {
  exists: boolean;
}

/** Appointment row inside `/patients/:id/history` (entity columns the app reads). */
export interface PatientHistoryAppointment {
  id: string;
  status: string;
  startTime: string;
  endTime: string | null;
  doctorId: string | null;
  locationId: string;
}

/** Treatment row (inside an encounter, or standalone). */
export interface PatientTreatment {
  id: string;
  date: string;
  encounterId: string | null;
}

/** `PatientEncounter` entity as returned in history (treatments newest first). */
export interface PatientHistoryEncounter {
  id: string;
  appointmentId: string | null;
  patientId: string;
  locationId: string;
  encounterDate: string;
  reason: string | null;
  chiefComplaint: string | null;
  examination: string | null;
  diagnosis: string | null;
  advice: string | null;
  followUpDate: string | null;
  treatments?: PatientTreatment[];
}

/** `GET /patients/:id/history`. */
export interface PatientHistory {
  patient: PatientDetail;
  appointments: PatientHistoryAppointment[];
  encounters: PatientHistoryEncounter[];
  standaloneTreatments: PatientTreatment[];
}

/**
 * `GET /patients/:id/vitals` returns a list; the first entry is the latest.
 * Decimal columns may arrive as numeric strings from Postgres — format
 * tolerantly, never assume `number`.
 */
export interface Vitals {
  id: string;
  patientId: string;
  locationId: string;
  appointmentId: string | null;
  recordedBy: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulseRate: number | null;
  temperature: number | string | null;
  oxygenSaturation: number | string | null;
  weightKg: number | string | null;
  heightCm: number | string | null;
  bmi: number | string | null;
  isDiabetic: boolean;
  isHypertensive: boolean;
  isPregnant: boolean;
  isOnBloodThinners: boolean;
  isOnAntibiotics: boolean;
  notes: string | null;
  recordedAt: string;
  createdAt: string;
}

/** `GET /patients/:id/teeth-charts` item (read-only summary; feature `patients.teeth_chart`). */
export interface PatientTeethChart {
  id: string;
  patientId: string;
  locationId: string;
  dentistId: string;
  appointmentId: string | null;
  chartData: Record<string, unknown>;
  periodontalChart: Record<string, unknown> | null;
  notes: string | null;
  isInitialChart: boolean;
  recordedAt: string;
  createdAt: string;
}

export type PrescriptionStatus = 'DRAFT' | 'FINALIZED' | 'AMENDED';

export interface PrescriptionMedicineItem {
  id?: string;
  medicineName: string;
  medicineNameUrdu?: string | null;
  type?: string | null;
  dosage: string;
  frequency: string;
  frequencyTiming?: string[];
  mealRelation?: string;
  duration: string;
  specialInstructions?: string | null;
  sortOrder?: number;
}

/** `GET /prescriptions/patient/:patientId` item (backend `Prescription` + doctor + medicines). */
export interface PrescriptionListItem {
  id: string;
  prescriptionNumber: string;
  locationId: string;
  patientId: string;
  appointmentId: string | null;
  encounterId?: string | null;
  doctorId: string | null;
  diagnosis: string | null;
  chiefComplaint: string | null;
  furtherPlan: string | null;
  instructionsEnglish: string | null;
  instructionsUrdu: string | null;
  status: PrescriptionStatus;
  signedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  medicines: PrescriptionMedicineItem[];
  doctor?: { id: string; fullName: string; designation?: string } | null;
}

/** The endpoint returns `{ data, total }` only — no `totalPages`: page while `page * limit < total`. */
export interface PrescriptionPage {
  data: PrescriptionListItem[];
  total: number;
}

export interface PatientAlert {
  kind: 'allergy' | 'blacklist' | 'minor';
  title: string;
  text: string;
}
