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

/** What a prescription preset is for. Mirrors the backend `PresetCategory`. */
export enum PresetCategory {
  GENERAL = 'GENERAL',
  PAIN_RELIEF = 'PAIN_RELIEF',
  TOOTHACHE = 'TOOTHACHE',
  TOOTH_SENSITIVITY = 'TOOTH_SENSITIVITY',
  SWELLING_AND_INFLAMMATION = 'SWELLING_AND_INFLAMMATION',
  FEVER = 'FEVER',
  ALLERGY = 'ALLERGY',
  INFECTION_ANTIBIOTIC = 'INFECTION_ANTIBIOTIC',
  DENTAL_ABSCESS = 'DENTAL_ABSCESS',
  ROOT_CANAL = 'ROOT_CANAL',
  POST_ROOT_CANAL = 'POST_ROOT_CANAL',
  FILLING_AND_RESTORATIVE = 'FILLING_AND_RESTORATIVE',
  EXTRACTION = 'EXTRACTION',
  POST_EXTRACTION = 'POST_EXTRACTION',
  WISDOM_TOOTH = 'WISDOM_TOOTH',
  DRY_SOCKET = 'DRY_SOCKET',
  ORAL_SURGERY = 'ORAL_SURGERY',
  POST_OPERATIVE = 'POST_OPERATIVE',
  ANESTHESIA_AFTERCARE = 'ANESTHESIA_AFTERCARE',
  IMPLANT = 'IMPLANT',
  CROWN_AND_BRIDGE = 'CROWN_AND_BRIDGE',
  DENTURE = 'DENTURE',
  ORTHODONTIC = 'ORTHODONTIC',
  SCALING_AND_CLEANING = 'SCALING_AND_CLEANING',
  TEETH_WHITENING_COSMETIC = 'TEETH_WHITENING_COSMETIC',
  GUM_DISEASE = 'GUM_DISEASE',
  MOUTH_ULCERS = 'MOUTH_ULCERS',
  ORAL_FUNGAL_INFECTION = 'ORAL_FUNGAL_INFECTION',
  BAD_BREATH = 'BAD_BREATH',
  DRY_MOUTH = 'DRY_MOUTH',
  TMJ_DISORDER = 'TMJ_DISORDER',
  DENTAL_TRAUMA = 'DENTAL_TRAUMA',
  EMERGENCY = 'EMERGENCY',
  PEDIATRIC = 'PEDIATRIC',
  PREGNANCY_SAFE = 'PREGNANCY_SAFE',
  ELDERLY = 'ELDERLY',
  DIABETIC_PATIENT = 'DIABETIC_PATIENT',
  PREVENTIVE_CARE = 'PREVENTIVE_CARE',
  VITAMINS_AND_SUPPLEMENTS = 'VITAMINS_AND_SUPPLEMENTS',
  OTHER = 'OTHER',
}

export const PRESET_CATEGORY_LABELS: Record<PresetCategory, string> = {
  [PresetCategory.GENERAL]: 'General',
  [PresetCategory.PAIN_RELIEF]: 'Pain relief',
  [PresetCategory.TOOTHACHE]: 'Toothache',
  [PresetCategory.TOOTH_SENSITIVITY]: 'Tooth sensitivity',
  [PresetCategory.SWELLING_AND_INFLAMMATION]: 'Swelling & inflammation',
  [PresetCategory.FEVER]: 'Fever',
  [PresetCategory.ALLERGY]: 'Allergy',
  [PresetCategory.INFECTION_ANTIBIOTIC]: 'Infection (antibiotics)',
  [PresetCategory.DENTAL_ABSCESS]: 'Dental abscess',
  [PresetCategory.ROOT_CANAL]: 'Root canal',
  [PresetCategory.POST_ROOT_CANAL]: 'After root canal',
  [PresetCategory.FILLING_AND_RESTORATIVE]: 'Filling & restorative',
  [PresetCategory.EXTRACTION]: 'Extraction',
  [PresetCategory.POST_EXTRACTION]: 'After extraction',
  [PresetCategory.WISDOM_TOOTH]: 'Wisdom tooth',
  [PresetCategory.DRY_SOCKET]: 'Dry socket',
  [PresetCategory.ORAL_SURGERY]: 'Oral surgery',
  [PresetCategory.POST_OPERATIVE]: 'Post-operative care',
  [PresetCategory.ANESTHESIA_AFTERCARE]: 'After anaesthesia',
  [PresetCategory.IMPLANT]: 'Implant',
  [PresetCategory.CROWN_AND_BRIDGE]: 'Crown & bridge',
  [PresetCategory.DENTURE]: 'Denture',
  [PresetCategory.ORTHODONTIC]: 'Orthodontic (braces)',
  [PresetCategory.SCALING_AND_CLEANING]: 'Scaling & cleaning',
  [PresetCategory.TEETH_WHITENING_COSMETIC]: 'Whitening & cosmetic',
  [PresetCategory.GUM_DISEASE]: 'Gum disease',
  [PresetCategory.MOUTH_ULCERS]: 'Mouth ulcers',
  [PresetCategory.ORAL_FUNGAL_INFECTION]: 'Oral fungal infection',
  [PresetCategory.BAD_BREATH]: 'Bad breath',
  [PresetCategory.DRY_MOUTH]: 'Dry mouth',
  [PresetCategory.TMJ_DISORDER]: 'Jaw joint (TMJ)',
  [PresetCategory.DENTAL_TRAUMA]: 'Dental trauma',
  [PresetCategory.EMERGENCY]: 'Emergency',
  [PresetCategory.PEDIATRIC]: 'Children',
  [PresetCategory.PREGNANCY_SAFE]: 'Pregnancy-safe',
  [PresetCategory.ELDERLY]: 'Elderly',
  [PresetCategory.DIABETIC_PATIENT]: 'Diabetic patients',
  [PresetCategory.PREVENTIVE_CARE]: 'Preventive care',
  [PresetCategory.VITAMINS_AND_SUPPLEMENTS]: 'Vitamins & supplements',
  [PresetCategory.OTHER]: 'Other',
}

/** Dropdown options: General first, Other last, the rest A–Z. */
export const PRESET_CATEGORY_OPTIONS = Object.values(PresetCategory)
  .map((value) => ({ value, label: PRESET_CATEGORY_LABELS[value] }))
  .sort((a, b) => {
    if (a.value === PresetCategory.GENERAL) return -1
    if (b.value === PresetCategory.GENERAL) return 1
    if (a.value === PresetCategory.OTHER) return 1
    if (b.value === PresetCategory.OTHER) return -1
    return a.label.localeCompare(b.label)
  })

/**
 * Presets saved before categories were fixed may hold free text ("General",
 * "Dental"…). Map what can be mapped; anything else becomes Other.
 */
export function toPresetCategory(raw: string | null | undefined): PresetCategory {
  const key = (raw ?? '').trim().toUpperCase().replace(/[\s&-]+/g, '_')
  return (Object.values(PresetCategory) as string[]).includes(key)
    ? (key as PresetCategory)
    : PresetCategory.OTHER
}

export function presetCategoryLabel(raw: string | null | undefined): string {
  return PRESET_CATEGORY_LABELS[toPresetCategory(raw)]
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
  /** The consultation this was written in. */
  encounterId?: string | null
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
  /** The consultation (encounter) the prescription is written in. */
  encounterId?: string
  /** Employee id of the prescribing doctor. */
  doctorId?: string
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
  Omit<
    CreatePrescriptionInput,
    'patientId' | 'appointmentId' | 'encounterId' | 'doctorId'
  >
> & {
  changeNotes?: string
}

export interface FinalizePrescriptionInput {
  signatureImageUrl?: string
  changeNotes?: string
}
