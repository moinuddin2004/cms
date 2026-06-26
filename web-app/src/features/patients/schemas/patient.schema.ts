import { z } from 'zod'
import {
  Gender,
  BloodGroup,
  MaritalStatus,
  Language,
  CommunicationPreference,
  PatientSource,
} from '../types'

const phoneRe = /^[0-9+\-\s()]{7,20}$/
const cnicRe = /^\d{5}-\d{7}-\d$/

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => !v || phoneRe.test(v), 'Phone number looks invalid')
  .optional()
  .or(z.literal(''))

/**
 * Zod schema for the patient create/edit form. Mirrors the field-level rules
 * enforced in PatientForm so validation lives in one place per CLAUDE.md.
 */
export const patientSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required'),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(phoneRe, 'Phone number looks invalid (7–20 digits)'),
  whatsappNumber: optionalPhone,
  dob: z
    .string()
    .refine((v) => !v || new Date(v) <= new Date(), 'Date of birth cannot be in the future')
    .optional()
    .or(z.literal('')),
  gender: z.nativeEnum(Gender).optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  maritalStatus: z.nativeEnum(MaritalStatus).optional(),
  cnic: z
    .string()
    .trim()
    .refine((v) => !v || cnicRe.test(v), 'CNIC must look like 42101-1234567-1')
    .optional()
    .or(z.literal('')),
  email: z.string().trim().email('Email address is invalid').optional().or(z.literal('')),
  city: z.string().optional(),
  address: z.string().optional(),
  preferredLanguage: z.nativeEnum(Language).optional(),
  communicationPref: z.nativeEnum(CommunicationPreference).optional(),
  source: z.nativeEnum(PatientSource).optional(),
  referredByText: z.string().optional(),
  occupation: z.string().optional(),
  internalNotes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  isMinor: z.boolean().default(false),
  guardianName: z.string().optional(),
  guardianPhone: optionalPhone,
  guardianRelation: z.string().optional(),
  medicalHistory: z.string().optional(),
  allergies: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: optionalPhone,
  emergencyContactRelation: z.string().optional(),
}).superRefine((val, ctx) => {
  if (val.isMinor && !val.guardianName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['guardianName'],
      message: 'Guardian name is required for minor patients',
    })
  }
})

export type PatientSchema = z.infer<typeof patientSchema>
