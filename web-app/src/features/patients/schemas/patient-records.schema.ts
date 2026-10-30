import { z } from 'zod'
import {
  CommDirection,
  CommPurpose,
  CommType,
  ConsentType,
  DocumentType,
} from '../types'

/**
 * Schemas for the patient-record dialogs (communications, documents,
 * prescriptions, consents, vitals). Text inputs stay strings in the form;
 * the hooks convert them when building the API payload. Max lengths mirror
 * the backend DTOs.
 */

const max = (n: number) => z.string().trim().max(n, `At most ${n} characters`)

// ── Communication log ──────────────────────────────────────────────────────

export const communicationSchema = z.object({
  // Picked from closed selects — values must match the backend enums.
  type: z.enum(CommType),
  direction: z.enum(CommDirection),
  purpose: z.enum(CommPurpose),
  subject: max(300),
  messageBody: z.string(),
})

export type CommunicationFormValues = z.input<typeof communicationSchema>

// ── Document upload ────────────────────────────────────────────────────────

export const documentSchema = z.object({
  file: z
    .custom<File | null>()
    .refine((f) => !!f, 'Please choose a file to upload.'),
  documentType: z.enum(DocumentType),
  /** Optional — defaults to the uploaded file's name. */
  fileName: max(255),
  notes: z.string(),
  toothNumber: max(10),
  isVisibleToPatient: z.boolean(),
})

export type DocumentFormValues = z.input<typeof documentSchema>

// ── Prescription ───────────────────────────────────────────────────────────

export const medicationSchema = z.object({
  name: z.string().trim().min(1, 'Medicine name is required'),
  dosage: z.string(),
  frequency: z.string(),
  instructions: z.string(),
})

export type MedicationFormValues = z.input<typeof medicationSchema>

export const prescriptionSchema = z.object({
  chiefComplaint: z.string(),
  diagnosis: z.string(),
  specialInstructions: z.string(),
  medications: z.array(medicationSchema).min(1, 'Add at least one medicine'),
})

export type PrescriptionFormValues = z.input<typeof prescriptionSchema>

// ── Consent ────────────────────────────────────────────────────────────────

export const consentSchema = z.object({
  consentType: z.enum(ConsentType),
  consentText: z.string().trim().min(1, 'Consent terms are required'),
  isAgreed: z.boolean(),
  signedByName: max(150).min(1, 'Signatory name is required'),
  signedByType: z.string(),
})

export type ConsentFormValues = z.input<typeof consentSchema>

// ── Vitals ─────────────────────────────────────────────────────────────────

/**
 * Optional numeric vital kept as the input's string. Empty is allowed;
 * otherwise it must be a number in [lo, hi] (whole for integer columns).
 */
const vital = (lo: number, hi: number, label: string, whole = false) =>
  z.string().superRefine((v, ctx) => {
    const s = v.trim()
    if (!s) return
    const n = Number(s)
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a number' })
    } else if (whole && !Number.isInteger(n)) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be a whole number`,
      })
    } else if (n < lo || n > hi) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be between ${lo} and ${hi}`,
      })
    }
  })

export const vitalsSchema = z
  .object({
    bpSystolic: vital(50, 300, 'Systolic', true),
    bpDiastolic: vital(30, 200, 'Diastolic', true),
    pulseRate: vital(20, 250, 'Pulse', true),
    temperature: vital(30, 45, 'Temp'),
    oxygenSaturation: vital(50, 100, 'SpO₂', true),
    weightKg: vital(1, 500, 'Weight'),
    heightCm: vital(20, 300, 'Height'),
    notes: z.string(),
  })
  .superRefine((v, ctx) => {
    const sys = Number(v.bpSystolic.trim() || NaN)
    const dia = Number(v.bpDiastolic.trim() || NaN)
    if (Number.isFinite(sys) && Number.isFinite(dia) && dia >= sys) {
      ctx.addIssue({
        code: 'custom',
        path: ['bpDiastolic'],
        message: 'Diastolic must be lower than systolic',
      })
    }
  })

export type VitalsFormValues = z.input<typeof vitalsSchema>

/** The numeric vitals (everything but notes). */
export type VitalKey = Exclude<keyof VitalsFormValues, 'notes'>
