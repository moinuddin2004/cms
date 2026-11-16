import { toMinor } from 'src/billing/common/money';
import type {
  ClinicRefDto,
  LocationRefDto,
  PatientAppointmentDto,
  PatientInvoiceDto,
  PatientInvoiceStatus,
  PatientPrescriptionDetailDto,
  PatientPrescriptionDto,
  PatientPrescriptionMedicineDto,
  PatientVisitDto,
} from './patient-reads.types';

/**
 * Narrow raw rows (exactly the columns the queries select) → response DTOs.
 * Every DTO field is assigned explicitly; extra row columns cannot leak.
 */

export interface LocationRow {
  locationId: string;
  locationName: string;
  locationTimezone: string;
  locationPhone: string | null;
  locationAddress: string | null;
}

export const iso = (v: Date | string | null | undefined): string | null =>
  v === null || v === undefined ? null : new Date(v).toISOString();

export function mapLocation(row: LocationRow): LocationRefDto {
  return {
    id: row.locationId,
    name: row.locationName,
    timezone: row.locationTimezone,
    phone: row.locationPhone ?? null,
    // No WhatsApp column on locations yet.
    whatsapp: null,
    address: row.locationAddress ?? null,
  };
}

export interface AppointmentRow extends LocationRow {
  id: string;
  doctorName: string | null;
  startTime: Date | string;
  endTime: Date | string;
  status: string;
  type: string;
  patientConfirmedAt?: Date | string | null;
}

/** Statuses a patient may still confirm (booking not yet cancelled / arrived). */
export const CONFIRMABLE_STATUSES = ['scheduled', 'confirmed'];

export function mapAppointment(
  row: AppointmentRow,
  profileId: string,
  clinic: ClinicRefDto,
  canConfirm = false,
): PatientAppointmentDto {
  return {
    id: row.id,
    profileId,
    clinic,
    location: mapLocation(row),
    doctorName: row.doctorName ?? null,
    startTime: iso(row.startTime)!,
    endTime: iso(row.endTime)!,
    status: row.status,
    type: row.type,
    patientConfirmedAt: iso(row.patientConfirmedAt),
    canConfirm,
  };
}

export interface VisitRow extends LocationRow {
  id: string;
  /** YYYY-MM-DD computed in SQL on the location's timezone. */
  visitDate: string;
  doctorName: string | null;
  followUpDate: string | null;
  diagnosis: string | null;
  treatments: string[] | null;
}

export function mapVisit(
  row: VisitRow,
  profileId: string,
  clinic: ClinicRefDto,
  showDiagnosis: boolean,
): PatientVisitDto {
  const dto: PatientVisitDto = {
    id: row.id,
    profileId,
    clinic,
    location: mapLocation(row),
    date: row.visitDate,
    doctorName: row.doctorName ?? null,
    followUpDate: row.followUpDate ?? null,
  };
  if (showDiagnosis) {
    dto.diagnosis = row.diagnosis ?? null;
    dto.treatments = row.treatments ?? [];
  }
  return dto;
}

export interface PrescriptionRow extends LocationRow {
  id: string;
  doctorName: string | null;
  number: string;
  signedAt: Date | string;
  medicinesCount: number | string;
}

export function mapPrescription(
  row: PrescriptionRow,
  profileId: string,
  clinic: ClinicRefDto,
  /** The PDF prints diagnosis/vitals: only when `show_diagnosis` is on. */
  hasPdf: boolean,
): PatientPrescriptionDto {
  return {
    id: row.id,
    profileId,
    clinic,
    location: mapLocation(row),
    doctorName: row.doctorName ?? null,
    number: row.number,
    issuedAt: iso(row.signedAt)!,
    medicinesCount: Number(row.medicinesCount),
    hasPdf,
  };
}

export interface MedicineRow {
  medicineName: string;
  medicineNameUrdu: string | null;
  type: string | null;
  dosage: string;
  frequency: string;
  frequencyTiming: string[] | null;
  mealRelation: string;
  duration: string;
  specialInstructions: string | null;
  specialInstructionsUrdu: string | null;
}

export function mapMedicine(row: MedicineRow): PatientPrescriptionMedicineDto {
  return {
    name: row.medicineName,
    nameUrdu: row.medicineNameUrdu ?? null,
    type: row.type ?? null,
    dosage: row.dosage,
    frequency: row.frequency,
    frequencyTiming: Array.isArray(row.frequencyTiming)
      ? [...row.frequencyTiming]
      : [],
    mealRelation: row.mealRelation,
    duration: row.duration,
    instructions: row.specialInstructions ?? null,
    instructionsUrdu: row.specialInstructionsUrdu ?? null,
  };
}

export function mapPrescriptionDetail(
  row: PrescriptionRow,
  medicines: MedicineRow[],
  profileId: string,
  clinic: ClinicRefDto,
  hasPdf: boolean,
): PatientPrescriptionDetailDto {
  return {
    ...mapPrescription(row, profileId, clinic, hasPdf),
    medicines: medicines.map(mapMedicine),
  };
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  issuedAt: Date | string;
  dueDate: string;
  totalAmount: number | string;
  paidAmount: number | string;
  balanceDue: number | string;
  locationTimezone: string;
}

export function invoiceStatusFor(
  row: Pick<InvoiceRow, 'dueDate' | 'paidAmount' | 'balanceDue'>,
  today: string,
): PatientInvoiceStatus {
  if (toMinor(row.balanceDue) <= 0) return 'paid';
  if (row.dueDate < today) return 'overdue';
  if (toMinor(row.paidAmount) > 0) return 'partial';
  return 'unpaid';
}

export function mapInvoice(
  row: InvoiceRow,
  profileId: string,
  today: string,
): PatientInvoiceDto {
  return {
    id: row.id,
    profileId,
    number: row.invoiceNumber,
    issuedAt: iso(row.issuedAt)!,
    timezone: row.locationTimezone,
    totalMinor: toMinor(row.totalAmount),
    paidMinor: toMinor(row.paidAmount),
    balanceMinor: toMinor(row.balanceDue),
    status: invoiceStatusFor(row, today),
  };
}
