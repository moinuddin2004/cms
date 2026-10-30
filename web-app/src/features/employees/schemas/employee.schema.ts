import { z } from 'zod'
import { percentToBps } from '@/features/billing/lib/commission-math'
import {
  EmploymentType,
  Gender,
  LeaveType,
  PaymentMethod,
  PayrollStatus,
} from '../types'

// Form values only — inputs stay strings; the form hooks convert them to the
// API payloads (`*FormData` in ../types) on submit.

const isNumber = (v: string) => v.trim() !== '' && Number.isFinite(Number(v))

// ─── Employee (create + edit) ───────────────────────────────────────

export const employeeFormSchema = z
  .object({
    fullName: z.string().min(2, 'Full name is required').max(255),
    phone: z.string().min(10, 'Valid phone number is required').max(20),
    cnic: z.string().max(20),
    designation: z.string().min(2, 'Designation is required').max(100),
    employmentRoleId: z.string().min(1, 'Role is required'),
    employmentType: z.enum(EmploymentType, {
      error: 'Employment type is required',
    }),
    joiningDate: z.string().min(1, 'Joining date is required'),
    // '' = not chosen (the field is optional).
    gender: z.union([z.enum(Gender), z.literal('')]),
    dob: z.string(),
    hasPortalAccess: z.boolean(),
    portalEmail: z.string(),
    portalPassword: z.string(),
    profilePictureUrl: z.string(),
    userId: z.string(),
    primaryLocationId: z.string(),
    grossSalary: z
      .string()
      .refine(
        (v) => v.trim() === '' || (isNumber(v) && Number(v) >= 0),
        'Enter a valid salary (0 or more)',
      ),
    // Optional compensation step (create only, when commissions are on).
    payType: z.enum(['SALARY', 'COMMISSION', 'SALARY_PLUS_COMMISSION']),
    commissionRate: z.string(),
    commissionBasis: z.enum(['NET', 'GROSS']),
  })
  .superRefine((data, ctx) => {
    if (
      data.payType !== 'SALARY' &&
      percentToBps(data.commissionRate) === null
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a commission between 0 and 100% (max 2 decimals)',
        path: ['commissionRate'],
      })
    }
    if (
      data.payType === 'SALARY_PLUS_COMMISSION' &&
      !Number(data.grossSalary.trim() || 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Salary + commission needs a salary',
        path: ['grossSalary'],
      })
    }
    // Credentials only when turning access on for someone with no login yet.
    if (data.hasPortalAccess && !data.userId) {
      if (data.portalEmail.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          message: 'Email is required for portal access',
          path: ['portalEmail'],
        })
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.portalEmail)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Enter a valid email address',
          path: ['portalEmail'],
        })
      }
      if (data.portalPassword.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          message: 'Password is required for portal access',
          path: ['portalPassword'],
        })
      } else if (data.portalPassword.length < 6) {
        ctx.addIssue({
          code: 'custom',
          message: 'Password must be at least 6 characters',
          path: ['portalPassword'],
        })
      }
    }
  })

export type EmployeeFormValues = z.input<typeof employeeFormSchema>

// ─── Salary ─────────────────────────────────────────────────────────

export const salaryFormSchema = z.object({
  grossSalary: z
    .string()
    .trim()
    .min(1, 'Salary is required')
    .refine(
      (v) => isNumber(v) && Number(v) > 0,
      'Salary must be a positive number',
    ),
})

export type SalaryFormValues = z.input<typeof salaryFormSchema>

// ─── Payroll ────────────────────────────────────────────────────────

export const markPaidFormSchema = z.object({
  paymentMethod: z.enum(PaymentMethod, { error: 'Choose a payment method' }),
  paymentReference: z.string(),
  notes: z.string(),
})

export type MarkPaidFormValues = z.input<typeof markPaidFormSchema>

export const payrollFormSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  salaryAmount: z
    .string()
    .trim()
    .min(1, 'Amount is required')
    .refine(isNumber, 'Enter a valid amount')
    .refine((v) => Number(v) >= 0, 'Amount must be 0 or more'),
  status: z.enum(PayrollStatus, { error: 'Status is required' }),
  notes: z.string(),
})

export type PayrollFormValues = z.input<typeof payrollFormSchema>

// ─── Leave ──────────────────────────────────────────────────────────

export const leaveFormSchema = z
  .object({
    leaveType: z.enum(LeaveType, { error: 'Leave type is required' }),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    reason: z.string(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  })

export type LeaveFormValues = z.input<typeof leaveFormSchema>

// ─── Availability override ──────────────────────────────────────────

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export const overrideFormSchema = z
  .object({
    date: z.string().min(1, 'Date is required'),
    isAvailable: z.boolean(),
    reason: z.string(),
    overrideHours: z.array(
      z.object({ startTime: z.string(), endTime: z.string() }),
    ),
  })
  .superRefine((data, ctx) => {
    // Hours only matter (and are only sent) when the day is available.
    if (!data.isAvailable) return
    data.overrideHours.forEach((slot, i) => {
      if (!HHMM.test(slot.startTime)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Required',
          path: ['overrideHours', i, 'startTime'],
        })
      }
      if (!HHMM.test(slot.endTime)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Required',
          path: ['overrideHours', i, 'endTime'],
        })
      } else if (slot.endTime <= slot.startTime) {
        ctx.addIssue({
          code: 'custom',
          message: 'End time must be after start time',
          path: ['overrideHours', i, 'endTime'],
        })
      }
    })
  })

export type OverrideFormValues = z.input<typeof overrideFormSchema>
