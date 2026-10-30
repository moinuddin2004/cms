import { z } from 'zod'

// ─── Enums (Matching Backend) ───────────────────────────────────────

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum BloodGroup {
  A_POS = 'A+',
  A_NEG = 'A-',
  B_POS = 'B+',
  B_NEG = 'B-',
  AB_POS = 'AB+',
  AB_NEG = 'AB-',
  O_POS = 'O+',
  O_NEG = 'O-',
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed',
}

export enum Language {
  URDU = 'urdu',
  ENGLISH = 'english',
}

export enum CommunicationPreference {
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  CALL = 'call',
  EMAIL = 'email',
}

export enum PatientSource {
  WALK_IN = 'walk_in',
  REFERRAL = 'referral',
  ONLINE = 'online',
  SOCIAL_MEDIA = 'social_media',
  GOOGLE = 'google',
  OTHER = 'other',
}

export enum GumCondition {
  HEALTHY = 'healthy',
  MILD_GINGIVITIS = 'mild_gingivitis',
  MODERATE_GINGIVITIS = 'moderate_gingivitis',
  SEVERE_PERIODONTITIS = 'severe_periodontitis',
}

export enum BrushingFrequency {
  ONCE_DAILY = 'once_daily',
  TWICE_DAILY = 'twice_daily',
  IRREGULAR = 'irregular',
  UNKNOWN = 'unknown',
}

export enum FlossingFrequency {
  DAILY = 'daily',
  OCCASIONALLY = 'occasionally',
  NEVER = 'never',
  UNKNOWN = 'unknown',
}

export enum TreatmentPlanStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export enum PlanItemStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  POSTPONED = 'postponed',
}

export enum DocumentType {
  XRAY = 'xray',
  CBCT_SCAN = 'cbct_scan',
  REPORT = 'report',
  PRESCRIPTION = 'prescription',
  CONSENT_FORM = 'consent_form',
  INSURANCE_CARD = 'insurance_card',
  CNIC_COPY = 'cnic_copy',
  PHOTO_BEFORE = 'photo_before',
  PHOTO_AFTER = 'photo_after',
  OTHER = 'other',
}

export enum ConsentType {
  GENERAL = 'general_treatment',
  EXTRACTION = 'extraction',
  IMPLANT = 'implant',
  ROOT_CANAL = 'root_canal',
  ORTHODONTIC = 'orthodontic',
  SEDATION = 'sedation',
  PHOTO_RELEASE = 'photo_release',
}

export enum CommType {
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  EMAIL = 'email',
  CALL = 'call',
  IN_PERSON = 'in_person',
}

export enum CommDirection {
  OUTBOUND = 'outbound',
  INBOUND = 'inbound',
}

export enum CommStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  RECEIVED = 'received',
}

export enum CommPurpose {
  APPOINTMENT_REMINDER = 'appointment_reminder',
  APPOINTMENT_CONFIRMATION = 'appointment_confirmation',
  APPOINTMENT_CANCELLATION = 'appointment_cancellation',
  RECALL_REMINDER = 'recall_reminder',
  FOLLOW_UP = 'follow_up',
  BILLING = 'billing',
  GENERAL = 'general',
  MARKETING = 'marketing',
  EMERGENCY = 'emergency',
}

export enum RecallType {
  SIX_MONTH_CHECKUP = '6_month_checkup',
  ANNUAL_CLEANING = 'annual_cleaning',
  POST_TREATMENT_FOLLOWUP = 'post_treatment_followup',
  IMPLANT_REVIEW = 'implant_review',
  ORTHODONTIC_REVIEW = 'orthodontic_review',
  CUSTOM = 'custom',
}

export enum RecallStatus {
  SCHEDULED = 'scheduled',
  REMINDER_SENT = 'reminder_sent',
  CONTACTED = 'contacted',
  BOOKED = 'booked',
  COMPLETED = 'completed',
  IGNORED = 'ignored',
  OVERDUE = 'overdue',
}

export enum ReferralStatus {
  PENDING = 'pending',
  REGISTERED = 'registered',
  REWARDED = 'rewarded',
  CANCELLED = 'cancelled',
}

export enum FeedbackCategory {
  DOCTOR = 'doctor',
  SERVICE = 'service',
  FACILITY = 'facility',
  BILLING = 'billing',
  WAITING_TIME = 'waiting_time',
  GENERAL = 'general',
}

// ─── Options Arrays ───────────────────────────────────────────────

export const GENDER_OPTIONS = [
  { label: 'Male', value: Gender.MALE },
  { label: 'Female', value: Gender.FEMALE },
  { label: 'Other', value: Gender.OTHER },
] as const

export const BLOOD_GROUP_OPTIONS = [
  { label: 'A+', value: BloodGroup.A_POS },
  { label: 'A-', value: BloodGroup.A_NEG },
  { label: 'B+', value: BloodGroup.B_POS },
  { label: 'B-', value: BloodGroup.B_NEG },
  { label: 'AB+', value: BloodGroup.AB_POS },
  { label: 'AB-', value: BloodGroup.AB_NEG },
  { label: 'O+', value: BloodGroup.O_POS },
  { label: 'O-', value: BloodGroup.O_NEG },
] as const

export const SOURCE_OPTIONS = [
  { label: 'Walk In', value: PatientSource.WALK_IN },
  { label: 'Referral', value: PatientSource.REFERRAL },
  { label: 'Online Booking', value: PatientSource.ONLINE },
  { label: 'Social Media', value: PatientSource.SOCIAL_MEDIA },
  { label: 'Google Search', value: PatientSource.GOOGLE },
  { label: 'Other', value: PatientSource.OTHER },
] as const

export const MARITAL_STATUS_OPTIONS = [
  { label: 'Single', value: MaritalStatus.SINGLE },
  { label: 'Married', value: MaritalStatus.MARRIED },
  { label: 'Divorced', value: MaritalStatus.DIVORCED },
  { label: 'Widowed', value: MaritalStatus.WIDOWED },
] as const

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

// ─── API Response Types ─────────────────────────────────────────────

export interface Patient {
  id: string
  patientNumber: string
  organizationId: string
  fullName: string
  phone: string
  dob: string | null
  gender: Gender | null
  bloodGroup: BloodGroup | null
  maritalStatus: MaritalStatus | null
  occupation: string | null
  cnic: string | null
  whatsappNumber: string | null
  email: string | null
  address: string | null
  city: string | null
  preferredLanguage: Language
  communicationPref: CommunicationPreference
  primaryLocationId: string | null
  source: PatientSource
  referredByText: string | null
  profilePictureUrl: string | null
  isMinor: boolean
  guardianName: string | null
  guardianPhone: string | null
  guardianRelation: string | null
  medicalHistory: string | null
  allergies: string | null // Note: Currently string[] in UI, parsing needed if backend is string
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
  internalNotes: string | null
  tags: string[]
  isActive: boolean
  isBlacklisted: boolean
  blacklistReason: string | null
  userId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface PatientVisit {
  id: string
  patientId: string
  locationId: string
  firstVisitDate: string | null
  lastVisitDate: string | null
  visitCount: number
  totalSpent: number
  isPreferredLocation: boolean
  createdAt: string
  updatedAt: string
}

// ─── Encounters & Treatments ────────────────────────────────────────
// NOTE: an Encounter is the real per-appointment visit record (one per
// confirmed/checked-in appointment), distinct from the PatientVisit aggregate
// above.

export interface Treatment {
  id: string
  patientId: string
  encounterId: string | null
  /** The treatment plan (Treatment Plans page) it follows, if any. */
  planTemplateId?: string | null
  planTemplate?: { id: string; name: string } | null
  organizationId: string
  locationId: string
  treatmentName: string
  notes: string | null
  /** Catalog service billing prices this treatment from, if the doctor picked one. */
  serviceId?: string | null
  /** Legacy fee. Absent for doctors — the server never sends them prices. */
  cost?: number | string | null
  date: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** The source appointment as embedded in an encounter detail response. */
export interface EncounterAppointment {
  id: string
  status: string
  type: string
  startTime: string
  endTime: string
  reasonForVisit: string | null
}

export interface Encounter {
  id: string
  /** The queue entry (booked or walk-in) whose consultation created this encounter. */
  queueEntryId: string
  /** NULL for walk-ins. */
  appointmentId: string | null
  patientId: string
  organizationId: string
  locationId: string
  encounterDate: string
  reason: string | null
  /** The doctor's notes for the visit (written on the consultation screen). */
  chiefComplaint?: string | null
  examination?: string | null
  diagnosis?: string | null
  advice?: string | null
  /** `yyyy-MM-dd`. */
  followUpDate?: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  treatments?: Treatment[]
  appointment?: EncounterAppointment | null
  patient?: { id: string; fullName: string; patientNumber: string } | null
}

export interface TreatmentFormData {
  treatmentName: string
  notes?: string
  cost?: number
  date?: string
  encounterId?: string
  planTemplateId?: string
}

export interface PatientHistory {
  patient: Patient
  appointments: any[]
  encounters: Encounter[]
  standaloneTreatments: Treatment[]
}

export interface PatientDentalInfo {
  id: string
  patientId: string
  lastDentalCheckup: string | null
  teethConditionNotes: string | null
  gumCondition: GumCondition
  teethSensitivity: boolean
  sensitivityNotes: string | null
  brushingFrequency: BrushingFrequency
  flossingFrequency: FlossingFrequency
  smokingStatus: boolean
  tobaccoChewing: boolean
  orthodonticHistory: boolean
  orthodonticNotes: string | null
  prostheticsInfo: string | null
  previousExtractions: string | null
  previousSurgeries: string | null
  xrayNotes: string | null
  dentistNotes: string | null
  createdAt: string
  updatedAt: string
}

export interface PatientTeethChart {
  id: string
  patientId: string
  locationId: string
  dentistId: string
  appointmentId: string | null
  chartData: Record<string, any>
  periodontalChart: Record<string, any> | null
  notes: string | null
  isInitialChart: boolean
  recordedAt: string
  createdAt: string
}

export interface PatientVitals {
  id: string
  patientId: string
  locationId: string
  appointmentId: string | null
  recordedBy: string
  bpSystolic: number | null
  bpDiastolic: number | null
  pulseRate: number | null
  temperature: number | null
  oxygenSaturation: number | null
  weightKg: number | null
  heightCm: number | null
  bmi: number | null
  isDiabetic: boolean
  isHypertensive: boolean
  isPregnant: boolean
  isOnBloodThinners: boolean
  isOnAntibiotics: boolean
  anesthesiaType: string | null
  anesthesiaDose: string | null
  anesthesiaAdministeredBy: string | null
  notes: string | null
  recordedAt: string
  createdAt: string
}

export interface TreatmentPlanItem {
  id: string
  planId: string
  procedureName: string
  procedureCode: string | null
  toothNumber: string | null
  toothSurface: string | null
  estimatedSessions: number
  completedSessions: number
  estimatedCost: number | null
  status: PlanItemStatus
  sequenceOrder: number
  assignedTo: string | null
  clinicalNotes: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PatientTreatmentPlan {
  id: string
  patientId: string
  locationId: string
  dentistId: string
  planNumber: string
  planName: string
  description: string | null
  estimatedCost: number | null
  discountAmount: number
  finalEstimatedCost: number | null
  status: TreatmentPlanStatus
  startDate: string | null
  expectedEndDate: string | null
  actualEndDate: string | null
  patientAccepted: boolean
  patientAcceptedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  items?: TreatmentPlanItem[]
}

export interface PatientPrescription {
  id: string
  patientId: string
  locationId: string
  prescribedBy: string
  appointmentId: string | null
  prescriptionNumber: string
  prescriptionDate: string
  chiefComplaint: string | null
  diagnosis: string | null
  medications: Record<string, any>[]
  specialInstructions: string | null
  followUpDate: string | null
  isPrinted: boolean
  printedAt: string | null
  printCount: number
  createdAt: string
}

export interface PatientDocument {
  id: string
  patientId: string
  locationId: string
  appointmentId: string | null
  documentType: DocumentType
  fileName: string
  fileUrl: string
  thumbnailUrl: string | null
  fileSizeBytes: number | null
  mimeType: string | null
  notes: string | null
  toothNumber: string | null
  takenDate: string | null
  isVisibleToPatient: boolean
  uploadedBy: string
  createdAt: string
}

export interface PatientConsent {
  id: string
  patientId: string
  locationId: string
  appointmentId: string | null
  consentType: ConsentType
  consentVersion: string
  consentText: string
  isAgreed: boolean
  agreedAt: string
  signedByName: string
  signedByType: string
  witnessedBy: string | null
  signatureUrl: string | null
  ipAddress: string | null
  createdAt: string
}

export interface PatientCommunication {
  id: string
  patientId: string
  locationId: string
  appointmentId: string | null
  type: CommType
  direction: CommDirection
  purpose: CommPurpose
  subject: string | null
  messageBody: string | null
  status: CommStatus
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  sentBy: string | null
  isAutomated: boolean
  automationTrigger: string | null
  externalMessageId: string | null
  createdAt: string
}

export interface PatientRecall {
  id: string
  patientId: string
  locationId: string
  dentistId: string | null
  appointmentId: string | null
  recallType: RecallType
  customName: string | null
  dueDate: string
  firstReminderSentAt: string | null
  secondReminderSentAt: string | null
  thirdReminderSentAt: string | null
  status: RecallStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PatientReferral {
  id: string
  referringPatientId: string
  referredPatientId: string | null
  referredName: string | null
  referredPhone: string | null
  referralDate: string
  rewardGiven: boolean
  rewardAmount: number | null
  rewardType: string | null
  rewardGivenAt: string | null
  status: ReferralStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PatientFeedback {
  id: string
  patientId: string
  locationId: string
  appointmentId: string | null
  dentistId: string | null
  rating: number
  category: FeedbackCategory
  feedbackText: string | null
  isAnonymous: boolean
  isPublished: boolean
  responseText: string | null
  respondedBy: string | null
  respondedAt: string | null
  createdAt: string
}

export interface PatientInsurance {
  id: string
  patientId: string
  providerName: string
  planName: string | null
  policyNumber: string
  policyHolderName: string | null
  groupNumber: string | null
  coverageDetails: string | null
  coveragePercentage: number
  maxAnnualBenefit: number | null
  usedBenefit: number
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  cardFrontUrl: string | null
  cardBackUrl: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

// ─── Zod Schemas For Patient Form ───────────────────────────────────

export const patientFormSchema = z.object({
  // Basic Info
  fullName: z.string().min(1, 'Full name is required').max(150),
  phone: z.string().min(1, 'Phone number is required').max(20),
  whatsappNumber: z.string().max(20).optional().default(''),
  dob: z.string().optional().default(''),
  gender: z.nativeEnum(Gender).optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  maritalStatus: z.nativeEnum(MaritalStatus).optional(),
  cnic: z.string().max(15).optional().default(''),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  city: z.string().max(100).optional().default(''),
  address: z.string().optional().default(''),
  preferredLanguage: z.nativeEnum(Language).optional().default(Language.URDU),
  communicationPref: z
    .nativeEnum(CommunicationPreference)
    .optional()
    .default(CommunicationPreference.WHATSAPP),

  // Source & Clinic
  source: z.nativeEnum(PatientSource).optional().default(PatientSource.WALK_IN),
  referredByText: z.string().max(200).optional().default(''),
  occupation: z.string().max(100).optional().default(''),
  internalNotes: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),

  // Guardian
  isMinor: z.boolean().optional().default(false),
  guardianName: z.string().max(150).optional().default(''),
  guardianPhone: z.string().max(20).optional().default(''),
  guardianRelation: z.string().max(50).optional().default(''),

  // Medical Quick Access & Emergency
  medicalHistory: z.string().optional().default(''),
  allergies: z.string().optional().default(''), // Converting array back to single string to match backend or keeping array? Backend says string. Actually backend has string | null for allergies, let's keep it as text in FE for simplicity or array then join
  emergencyContactName: z.string().max(150).optional().default(''),
  emergencyContactPhone: z.string().max(20).optional().default(''),
  emergencyContactRelation: z.string().max(50).optional().default(''),
})

export type PatientFormData = z.infer<typeof patientFormSchema>

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T> {
  data: T
  message: string
  isSuccess: boolean
  httpStatusCode: number
}

export interface PatientListParams {
  page?: number
  limit?: number
  search?: string
  gender?: string
  bloodGroup?: string
  source?: string
  city?: string
  tag?: string
  isActive?: boolean
  isBlacklisted?: boolean
  isMinor?: boolean
  sortBy?: 'createdAt' | 'fullName' | 'patientNumber'
  sortOrder?: 'ASC' | 'DESC'
}

// ─── Form Step Config ───────────────────────────────────────────────

export const FORM_STEPS = [
  {
    id: 0,
    title: 'Basic Info',
    description: 'Personal, Guardian, Emergency & Medical',
  },
  { id: 1, title: 'Clinic Info', description: 'Source & Clinic Notes' },
] as const

// ─── Import (Excel / CSV migration) ─────────────────────────────────

/** Patient fields a spreadsheet column can be mapped to (backend IMPORT_FIELDS). */
export type PatientImportField =
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'whatsappNumber'
  | 'cnic'
  | 'gender'
  | 'dob'
  | 'age'
  | 'email'
  | 'address'
  | 'city'
  | 'bloodGroup'
  | 'maritalStatus'
  | 'occupation'
  | 'allergies'
  | 'medicalHistory'
  | 'notes'
  | 'legacyNumber'
  | 'guardianName'
  | 'guardianPhone'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
  | 'referredBy'

/** `POST /patients/import/parse` result. */
export interface ParsedPatientImport {
  headers: string[]
  rows: Record<string, string>[]
  suggestedMapping: Record<string, PatientImportField | null>
}

export type PatientImportRow = Partial<Record<PatientImportField, string>>
export type DuplicateStrategy = 'skip' | 'create'

export interface PatientImportRequest {
  rows: PatientImportRow[]
  dryRun: boolean
  duplicateStrategy: DuplicateStrategy
  /** Index of rows[0] in the whole file. */
  offset?: number
}

export type PatientImportRowStatus =
  'created' | 'would_create' | 'duplicate' | 'error'

export interface PatientImportRowResult {
  /** 0-based position in the file. */
  index: number
  status: PatientImportRowStatus
  patientId?: string
  patientNumber?: string
  errors?: string[]
}

export interface PatientImportResult {
  dryRun: boolean
  rows: PatientImportRowResult[]
  totals: {
    total: number
    created: number
    wouldCreate: number
    duplicates: number
    errors: number
  }
}
