// ─── Enums (Matching Backend) ───────────────────────────────────────

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  VISITING = 'visiting',
  CONTRACT = 'contract',
}

export enum LeaveType {
  ANNUAL = 'annual',
  SICK = 'sick',
  UNPAID = 'unpaid',
  MATERNITY = 'maternity',
  PATERNITY = 'paternity',
  OTHER = 'other',
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum PayrollStatus {
  PENDING = 'pending',
  PAID = 'paid',
  ON_HOLD = 'on_hold',
}

export enum PaymentMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  CHEQUE = 'cheque',
}

// ─── Options Arrays ───────────────────────────────────────────────

export const GENDER_OPTIONS = [
  { label: 'Male', value: Gender.MALE },
  { label: 'Female', value: Gender.FEMALE },
  { label: 'Other', value: Gender.OTHER },
] as const

export const EMPLOYMENT_TYPE_OPTIONS = [
  { label: 'Full Time', value: EmploymentType.FULL_TIME },
  { label: 'Part Time', value: EmploymentType.PART_TIME },
  { label: 'Visiting', value: EmploymentType.VISITING },
  { label: 'Contract', value: EmploymentType.CONTRACT },
] as const

export const STATUS_OPTIONS = [
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
] as const

export const PAYMENT_METHOD_OPTIONS = [
  { label: 'Cash', value: PaymentMethod.CASH },
  { label: 'Bank Transfer', value: PaymentMethod.BANK_TRANSFER },
  { label: 'Cheque', value: PaymentMethod.CHEQUE },
]

export const PAYROLL_STATUS_OPTIONS = [
  { label: 'Pending', value: PayrollStatus.PENDING },
  { label: 'Paid', value: PayrollStatus.PAID },
  { label: 'On Hold', value: PayrollStatus.ON_HOLD },
] as const

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

export const LEAVE_TYPE_OPTIONS = [
  { label: 'Annual', value: LeaveType.ANNUAL },
  { label: 'Sick', value: LeaveType.SICK },
  { label: 'Unpaid', value: LeaveType.UNPAID },
  { label: 'Maternity', value: LeaveType.MATERNITY },
  { label: 'Paternity', value: LeaveType.PATERNITY },
  { label: 'Other', value: LeaveType.OTHER },
] as const

export const LEAVE_STATUS_OPTIONS = [
  { label: 'Pending', value: LeaveStatus.PENDING },
  { label: 'Approved', value: LeaveStatus.APPROVED },
  { label: 'Rejected', value: LeaveStatus.REJECTED },
  { label: 'Cancelled', value: LeaveStatus.CANCELLED },
] as const

// ─── Schedule Helpers ───────────────────────────────────────────────

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const DAY_SHORT = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const

export const SLOT_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
]

// ─── API Response Types ─────────────────────────────────────────────

export interface EmploymentRole {
  id: string
  name: string
  slug: string
  permissions: Record<string, boolean>
  isSystemRole: boolean
  isActive: boolean
}

export interface CurrentSalary {
  grossSalary: number
  effectiveFrom?: string
}

export interface Employee {
  id: string
  fullName: string
  phone: string
  cnic: string | null
  gender: Gender | null
  dob: string | null
  profilePictureUrl: string | null
  isActive: boolean
  // Assignment fields (flattened from backend)
  assignmentId?: string
  designation: string
  employmentType: EmploymentType
  employeeCode: string
  joiningDate: string
  grossSalary: number | null
  /** Current compensation plan type at this location (null = none yet). */
  compensationType?: 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION' | null
  hasPortalAccess: boolean
  isPrimary: boolean
  userId: string | null
  /** How their login signs in (detail endpoint only; null = no login). */
  login?: EmployeeLogin | null
  organizationId?: string
  primaryLocationId?: string
  primaryLocation?: { id: string; name: string } | null
  employmentRoleId?: string
  employmentRole: EmploymentRole | null
  createdBy?: string
  createdAt?: string
  updatedAt?: string
  currentSalary: CurrentSalary | null
}

export interface EmployeeLogin {
  email: string
  hasPassword: boolean
  googleLinked: boolean
  googleEmail: string | null
  /** A Google login that hasn't signed in yet. */
  awaitingFirstGoogleSignIn: boolean
}

export interface ScheduleDay {
  id?: string
  dayOfWeek: number // 0-6
  isWorking: boolean
  startTime: string | null // "09:00"
  endTime: string | null // "17:00"
  slotDuration: number
}

export interface EmployeeLeave {
  id: string
  employeeId: string
  employee?: { id: string; fullName: string }
  organizationId: string
  locationId: string
  leaveType: LeaveType
  startDate: string
  endDate: string
  totalDays: number
  status: LeaveStatus
  reason: string | null
  reviewNote: string | null
  approvedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface LeaveBalance {
  year: number
  totalApprovedDays: number
  pendingRequests: number
  byType: Record<string, number>
}

export interface OverrideHoursSlot {
  startTime: string // "09:00"
  endTime: string // "13:00"
}

export interface AvailabilityOverride {
  id: string
  employeeId: string
  organizationId: string
  locationId: string
  date: string
  isAvailable: boolean
  reason: string | null
  overrideHours: OverrideHoursSlot[] | null
  createdAt: string
  updatedAt: string
}

export interface LeaveFilterParams {
  employeeId?: string
  status?: LeaveStatus
  leaveType?: LeaveType
}

export interface PayrollRecord {
  id: string
  employeeId: string
  employee?: { fullName: string; employeeCode?: string }
  month: number
  year: number
  periodLabel: string
  salaryAmount: number
  /** Breakdown in integer minor units (total = base salary + commission). */
  baseSalaryMinor?: number
  commissionMinor?: number
  totalMinor?: number
  status: PayrollStatus
  paidAt: string | null
  paymentMethod: PaymentMethod | null
  paymentReference: string | null
  notes: string | null
}

export interface PayrollSummary {
  totalEmployees: number
  totalAmount: number
  paidCount: number
  pendingCount: number
  onHoldCount?: number
  paidAmount: number
  pendingAmount: number
}

export interface LocationPayrollResponse {
  records: PayrollRecord[]
  summary: PayrollSummary
}

export interface GeneratePayrollResult {
  generated: number
  skipped: number
  noSalary: string[]
  records: PayrollRecord[]
}

// ─── Form Payloads ──────────────────────────────────────────────────
// What the forms send to the API. The Zod schemas that validate the form
// values (strings) live in ./schemas/employee.schema.ts.

export interface EmployeeFormData {
  fullName: string
  phone: string
  cnic?: string
  designation: string
  employmentRoleId: string
  employmentType: EmploymentType
  joiningDate: string
  gender?: Gender
  dob?: string
  hasPortalAccess: boolean
  portalEmail?: string
  portalLoginMethod?: 'password' | 'google'
  portalPassword?: string
  profilePictureUrl?: string
  userId?: string
  primaryLocationId?: string
  grossSalary?: number
  // Optional compensation step (create only, when commissions are on).
  payType: 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION'
  commissionRate?: string
  commissionBasis: 'NET' | 'GROSS'
}

export interface SalaryFormData {
  grossSalary: number
}

export interface MarkPaidFormData {
  paymentMethod: PaymentMethod
  paymentReference?: string
  notes?: string
}

export interface PayrollFormData {
  employeeId: string
  month: number
  year: number
  salaryAmount: number
  status: PayrollStatus
  notes?: string
}

export interface LeaveFormData {
  leaveType: LeaveType
  startDate: string
  endDate: string
  reason?: string
}

export interface OverrideFormData {
  date: string
  isAvailable: boolean
  reason?: string
  overrideHours?: OverrideHoursSlot[]
}

// ─── Query / Filter Params ──────────────────────────────────────────

export interface EmployeeListParams {
  page?: number
  limit?: number
  search?: string
  role?: string
  employmentType?: string
  isActive?: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ApiResponse<T> {
  data: T
  message: string
  isSuccess: boolean
  httpStatusCode: number
}
