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
  id: string
  grossSalary: number
  effectiveFrom: string
  effectiveUntil: string | null
  isCurrent: boolean
  notes: string | null
  createdBy: string
  createdAt: string
}

export interface Employee {
  id: string
  organizationId: string
  employeeCode: string
  fullName: string
  phone: string
  cnic: string | null
  gender: Gender | null
  dob: string | null
  profilePictureUrl: string | null
  designation: string
  employmentRoleId: string
  employmentRole: EmploymentRole | null
  employmentType: EmploymentType
  joiningDate: string
  primaryLocationId: string
  primaryLocation: { id: string; name: string } | null
  hasPortalAccess: boolean
  userId: string | null
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  currentSalary: CurrentSalary | null
}

export interface EmployeeSalary {
  id: string
  employeeId: string
  organizationId: string
  grossSalary: number
  effectiveFrom: string
  effectiveUntil: string | null
  isCurrent: boolean
  notes: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface PayrollRecord {
  id: string
  employeeId: string
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

// ─── Zod Schemas ────────────────────────────────────────────────────

export const employeeFormSchema = z.object({
  fullName: z.string().min(2, 'Full name is required').max(255),
  phone: z.string().min(10, 'Valid phone number is required').max(20),
  cnic: z.string().max(20).optional().transform(v => v === '' ? undefined : v),
  designation: z.string().min(2, 'Designation is required').max(100),
  employmentRoleId: z.string().min(1, 'Role is required'),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  joiningDate: z.string().min(1, 'Joining date is required'),
  primaryLocationId: z.string().min(1, 'Location is required'),
  gender: z.nativeEnum(Gender).optional(),
  dob: z.string().optional().transform(v => v === '' ? undefined : v),
  hasPortalAccess: z.boolean().default(false),
  profilePictureUrl: z.string().optional().transform(v => v === '' ? undefined : v),
  userId: z.string().optional().transform(v => v === '' ? undefined : v),
})

export type EmployeeFormData = z.infer<typeof employeeFormSchema>

export const salaryFormSchema = z.object({
  grossSalary: z.coerce.number().min(1, 'Salary must be a positive number'),
  effectiveFrom: z.string().min(1, 'Effective date is required'),
  notes: z.string().optional(),
})

export type SalaryFormData = z.infer<typeof salaryFormSchema>

export const markPaidFormSchema = z.object({
  paymentMethod: z.nativeEnum(PaymentMethod),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
})

export type MarkPaidFormData = z.infer<typeof markPaidFormSchema>

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
