import { z } from 'zod'
import { MealRelation } from '../types'

const max = (n: number) => z.string().max(n, `At most ${n} characters`)

/** The patient picked in the builder (kept whole so the card and preview can show it). */
export interface PrescriptionPatient {
  id: string
  fullName: string
  phone: string
  patientNumber?: string
  dob?: string | null
  gender?: string | null
}

// ── Vitals ─────────────────────────────────────────────────────────────────

/**
 * Optional vital kept as typed (the preview / PDF print the text). Empty is
 * fine; otherwise it must be a number in range. A trailing unit the
 * placeholder suggests (°C, %, kg, cm, bpm) is allowed.
 */
const vital = (
  label: string,
  ranges: { lo: number; hi: number }[],
  unit: RegExp,
  whole = false,
) =>
  z.string().superRefine((v, ctx) => {
    const s = v.trim().replace(unit, '').trim()
    if (!v.trim()) return
    const n = Number(s)
    if (!s || !Number.isFinite(n)) {
      ctx.addIssue({ code: 'custom', message: 'Enter a number' })
    } else if (whole && !Number.isInteger(n)) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be a whole number`,
      })
    } else if (!ranges.some((r) => n >= r.lo && n <= r.hi)) {
      ctx.addIssue({
        code: 'custom',
        message: `${label} must be ${ranges.map((r) => `${r.lo}–${r.hi}`).join(' or ')}`,
      })
    }
  })

const BP = /^(\d{2,3})\s*\/\s*(\d{2,3})(\s*mm\s*hg)?$/i

export const prescriptionVitalsSchema = z.object({
  bp: z.string().superRefine((v, ctx) => {
    const s = v.trim()
    if (!s) return
    const m = BP.exec(s)
    if (!m) {
      ctx.addIssue({ code: 'custom', message: 'Enter as 120/80' })
      return
    }
    const sys = Number(m[1])
    const dia = Number(m[2])
    if (sys < 50 || sys > 300) {
      ctx.addIssue({
        code: 'custom',
        message: 'Systolic must be between 50 and 300',
      })
    } else if (dia < 30 || dia > 200) {
      ctx.addIssue({
        code: 'custom',
        message: 'Diastolic must be between 30 and 200',
      })
    } else if (dia >= sys) {
      ctx.addIssue({
        code: 'custom',
        message: 'Diastolic must be lower than systolic',
      })
    }
  }),
  pulse: vital('Pulse', [{ lo: 20, hi: 250 }], /\s*(bpm|\/min)$/i, true),
  // °C or °F — both are in use at clinics.
  temperature: vital(
    'Temp',
    [
      { lo: 30, hi: 45 },
      { lo: 86, hi: 113 },
    ],
    /\s*°?\s*[cf]$/i,
  ),
  spo2: vital('SpO₂', [{ lo: 50, hi: 100 }], /\s*%$/, true),
  weight: vital('Weight', [{ lo: 1, hi: 500 }], /\s*kgs?$/i),
  height: vital('Height', [{ lo: 20, hi: 300 }], /\s*cm$/i),
})

export type PrescriptionVitalsValues = z.input<typeof prescriptionVitalsSchema>

// ── Medicines ──────────────────────────────────────────────────────────────

/**
 * One medicine line. Lines without a name are dropped on save; a named line
 * needs dose, frequency and duration (all required by the backend DTO).
 */
export const prescriptionMedicineSchema = z
  .object({
    medicineDirectoryId: z.string().nullable().optional(),
    medicineName: max(200),
    medicineNameUrdu: z.string().nullable().optional(),
    type: z.string().nullable().optional(),
    dosage: max(50),
    frequency: max(100),
    frequencyTiming: z.array(z.string()).optional(),
    mealRelation: z.enum(MealRelation).optional(),
    duration: max(50),
    specialInstructions: z.string().nullable().optional(),
    specialInstructionsUrdu: z.string().nullable().optional(),
  })
  .superRefine((m, ctx) => {
    if (!m.medicineName.trim()) return
    const need = (key: 'dosage' | 'frequency' | 'duration', msg: string) => {
      if (!m[key].trim())
        ctx.addIssue({ code: 'custom', path: [key], message: msg })
    }
    need('dosage', 'Dose is required')
    need('frequency', 'Frequency is required')
    need('duration', 'Duration is required')
  })

export type PrescriptionMedicineValues = z.input<
  typeof prescriptionMedicineSchema
>

// ── Prescription ───────────────────────────────────────────────────────────

/** The new / edit prescription page. Mirrors CreatePrescriptionDto. */
export const prescriptionSchema = z.object({
  patient: z.custom<PrescriptionPatient | null>(
    (v) => v != null,
    'Select a patient',
  ),
  doctorId: z.string().min(1, 'Select the prescribing doctor'),
  templateId: z.string(),
  treatmentPlanTemplateId: z.string(),
  chiefComplaint: max(1000),
  diagnosis: max(1000),
  furtherPlan: max(4000),
  instructionsEnglish: max(4000),
  instructionsUrdu: max(4000),
  vitals: prescriptionVitalsSchema,
  // Refined on the array itself (not the whole object) so the message still
  // shows while other fields are invalid.
  medicines: z
    .array(prescriptionMedicineSchema)
    .refine(
      (list) => list.some((m) => m.medicineName.trim()),
      'Add at least one medicine',
    ),
})

export type PrescriptionFormValues = z.input<typeof prescriptionSchema>
