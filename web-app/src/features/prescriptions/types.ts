// ─── Enums (mirror backend) ───────────────────────────────────────────

export enum MedicineType {
  TABLET = 'TABLET',
  CAPSULE = 'CAPSULE',
  SYRUP = 'SYRUP',
  INJECTION = 'INJECTION',
  CREAM = 'CREAM',
  DROPS = 'DROPS',
  INHALER = 'INHALER',
  SACHET = 'SACHET',
  SUPPOSITORY = 'SUPPOSITORY',
  OINTMENT = 'OINTMENT',
  GEL = 'GEL',
  PATCH = 'PATCH',
  SPRAY = 'SPRAY',
  POWDER = 'POWDER',
  OTHER = 'OTHER',
}

export enum MealRelation {
  BEFORE_MEAL = 'BEFORE_MEAL',
  AFTER_MEAL = 'AFTER_MEAL',
  WITH_MEAL = 'WITH_MEAL',
  EMPTY_STOMACH = 'EMPTY_STOMACH',
  NONE = 'NONE',
}

export enum PageSize {
  A4 = 'A4',
  A5 = 'A5',
  LETTER = 'LETTER',
  CUSTOM = 'CUSTOM',
}

export enum PageOrientation {
  PORTRAIT = 'PORTRAIT',
  LANDSCAPE = 'LANDSCAPE',
}

export enum PrescriptionStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED',
  AMENDED = 'AMENDED',
}

export enum PrescriptionHistoryChangeType {
  CREATED = 'CREATED',
  AMENDED = 'AMENDED',
  FINALIZED = 'FINALIZED',
  PRINTED = 'PRINTED',
  SHARED = 'SHARED',
}

// ─── Option lists (UI dropdowns) ──────────────────────────────────────

export const MEDICINE_TYPE_OPTIONS = [
  { label: 'Tablet', value: MedicineType.TABLET },
  { label: 'Capsule', value: MedicineType.CAPSULE },
  { label: 'Syrup', value: MedicineType.SYRUP },
  { label: 'Injection', value: MedicineType.INJECTION },
  { label: 'Cream', value: MedicineType.CREAM },
  { label: 'Drops', value: MedicineType.DROPS },
  { label: 'Inhaler', value: MedicineType.INHALER },
  { label: 'Sachet', value: MedicineType.SACHET },
  { label: 'Suppository', value: MedicineType.SUPPOSITORY },
  { label: 'Ointment', value: MedicineType.OINTMENT },
  { label: 'Gel', value: MedicineType.GEL },
  { label: 'Patch', value: MedicineType.PATCH },
  { label: 'Spray', value: MedicineType.SPRAY },
  { label: 'Powder', value: MedicineType.POWDER },
  { label: 'Other', value: MedicineType.OTHER },
] as const

export const MEAL_RELATION_OPTIONS = [
  { label: 'No preference', value: MealRelation.NONE },
  { label: 'Before meal', value: MealRelation.BEFORE_MEAL },
  { label: 'After meal', value: MealRelation.AFTER_MEAL },
  { label: 'With meal', value: MealRelation.WITH_MEAL },
  { label: 'Empty stomach', value: MealRelation.EMPTY_STOMACH },
] as const

export const FREQUENCY_PRESETS = [
  'Once a day',
  'Twice a day',
  '3 times a day',
  '4 times a day',
  '1 Morning',
  '1 Evening',
  '1 Morning, 1 Evening',
  'Every 4 hours',
  'Every 6 hours',
  'Every 8 hours',
  'SOS (as needed)',
]

export const DURATION_PRESETS = [
  '3 Days',
  '5 Days',
  '7 Days',
  '10 Days',
  '14 Days',
  '1 Month',
  'Continue',
  'As needed',
  'SOS',
]

export const TIMING_TAGS = ['morning', 'afternoon', 'evening', 'night', 'sos']

// ─── Domain types ─────────────────────────────────────────────────────

export interface MedicineDirectoryItem {
  id: string
  organizationId: string
  name: string
  genericName: string | null
  nameUrdu: string | null
  type: MedicineType
  strength: string | null
  manufacturer: string | null
  defaultDosage: string | null
  defaultFrequency: string | null
  defaultDuration: string | null
  defaultMealRelation: MealRelation
  instructionsUrdu: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PrescriptionTemplate {
  id: string
  organizationId: string
  locationId: string | null
  name: string
  isDefault: boolean
  pageSize: PageSize
  orientation: PageOrientation
  customWidthMm: number | null
  customHeightMm: number | null
  header: Record<string, any>
  footer: Record<string, any>
  styling: Record<string, any>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface TreatmentPlanTemplateMedicine {
  id: string
  templateId: string
  medicineDirectoryId: string | null
  medicineName: string
  medicineNameUrdu: string | null
  type: string | null
  dosage: string
  frequency: string
  frequencyTiming: string[]
  mealRelation: MealRelation
  duration: string
  specialInstructions: string | null
  specialInstructionsUrdu: string | null
  sortOrder: number
}

export interface TreatmentPlanTemplate {
  id: string
  organizationId: string
  name: string
  description: string | null
  category: string
  specialtyTags: string[]
  furtherPlan: string | null
  instructionsEnglish: string | null
  instructionsUrdu: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  medicines: TreatmentPlanTemplateMedicine[]
}

export interface PrescriptionMedicine {
  id?: string
  medicineDirectoryId?: string | null
  medicineName: string
  medicineNameUrdu?: string | null
  type?: string | null
  dosage: string
  frequency: string
  frequencyTiming?: string[]
  mealRelation?: MealRelation
  duration: string
  specialInstructions?: string | null
  specialInstructionsUrdu?: string | null
  sortOrder?: number
}

export interface Prescription {
  id: string
  prescriptionNumber: string
  organizationId: string
  locationId: string
  patientId: string
  appointmentId: string | null
  doctorId: string | null
  prescriptionTemplateId: string | null
  treatmentPlanTemplateId: string | null
  diagnosis: string | null
  chiefComplaint: string | null
  furtherPlan: string | null
  instructionsEnglish: string | null
  instructionsUrdu: string | null
  vitals: Record<string, any> | null
  signatureImageUrl: string | null
  signedAt: string | null
  status: PrescriptionStatus
  pdfUrl: string | null
  version: number
  createdAt: string
  updatedAt: string
  medicines: PrescriptionMedicine[]
  patient?: {
    id: string
    fullName: string
    patientNumber: string
    phone: string
    dob?: string | null
    gender?: string | null
  }
  doctor?: { id: string; fullName: string; designation?: string } | null
  prescriptionTemplate?: PrescriptionTemplate | null
  treatmentPlanTemplate?: TreatmentPlanTemplate | null
}

export interface DoctorSignature {
  id: string
  employeeId: string
  organizationId: string
  signatureImageUrl: string
  signatureData: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PrescriptionHistoryEntry {
  id: string
  prescriptionId: string
  version: number
  changedBy: string | null
  changeType: PrescriptionHistoryChangeType
  previousData: Record<string, any> | null
  changeNotes: string | null
  createdAt: string
  changedByEmployee?: { id: string; fullName: string } | null
}

// ─── Request shapes ───────────────────────────────────────────────────

export interface PrescriptionFilterParams {
  patientId?: string
  doctorId?: string
  status?: PrescriptionStatus
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

export interface PrescriptionListResponse {
  data: Prescription[]
  total: number
  page: number
  limit: number
}

export interface CreatePrescriptionInput {
  patientId: string
  appointmentId?: string
  prescriptionTemplateId?: string
  treatmentPlanTemplateId?: string
  diagnosis?: string
  chiefComplaint?: string
  furtherPlan?: string
  instructionsEnglish?: string
  instructionsUrdu?: string
  vitals?: Record<string, any>
  medicines?: PrescriptionMedicine[]
}

export type UpdatePrescriptionInput = Partial<
  Omit<CreatePrescriptionInput, 'patientId' | 'appointmentId'>
> & {
  changeNotes?: string
}

export interface FinalizePrescriptionInput {
  signatureImageUrl?: string
  changeNotes?: string
}
