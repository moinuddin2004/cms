import { z } from 'zod'

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
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const

export const DAY_SHORT = [
  'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
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
  hasPortalAccess: boolean
  isPrimary: boolean
  userId: string | null
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

// ─── Zod Schemas ────────────────────────────────────────────────────

export const employeeFormSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(255),
  phone: z.string().min(10, 'Valid phone number is required').max(20),
  cnic: z.string().max(20).optional().transform((v) => (v === '' ? undefined : v)),
  designation: z.string().min(2, 'Designation is required').max(100),
  employmentRoleId: z.string().min(1, 'Role is required'),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  joiningDate: z.string().min(1, 'Joining date is required'),
  gender: z.nativeEnum(Gender).optional(),
  dob: z.string().optional().transform((v) => (v === '' ? undefined : v)),
  hasPortalAccess: z.boolean().default(false),
  profilePictureUrl: z
    .string()
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  userId: z
    .string()
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  grossSalary: z.coerce.number().min(0).optional(),
})

export type EmployeeFormData = z.infer<typeof employeeFormSchema>

export const salaryFormSchema = z.object({
  grossSalary: z.coerce.number().min(1, 'Salary must be a positive number'),
})

export type SalaryFormData = z.infer<typeof salaryFormSchema>

export const markPaidFormSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
})

export type MarkPaidFormData = z.infer<typeof markPaidFormSchema>

export const leaveFormSchema = z
  .object({
    leaveType: z.nativeEnum(LeaveType),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    reason: z.string().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  })

export type LeaveFormData = z.infer<typeof leaveFormSchema>

// ─── Query / Filter Params ──────────────────────────────────────────

export interface EmployeeListParams {
  page?: number
  limit?: number
  search?: string
  role?: string
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
