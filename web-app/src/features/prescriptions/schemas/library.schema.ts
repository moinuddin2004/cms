import { z } from 'zod'
import { MealRelation, MedicineType, PageSize, PresetCategory } from '../types'

const max = (n: number) => z.string().max(n, `At most ${n} characters`)

const requiredName = (n: number) =>
  z.string().trim().min(1, 'Name is required').max(n, `At most ${n} characters`)

/** One medicine in the clinic's catalogue. Lengths mirror the backend DTO. */
export const medicineSchema = z.object({
  name: requiredName(200),
  genericName: max(200),
  nameUrdu: max(200),
  type: z.enum(MedicineType),
  strength: max(100),
  defaultDosage: max(100),
  defaultFrequency: max(100),
  defaultDuration: max(100),
  defaultMealRelation: z.enum(MealRelation),
})

export type MedicineFormValues = z.input<typeof medicineSchema>

/**
 * A print layout. Letterhead / footer / styling go into jsonb on the server,
 * so only the name has limits; the colour comes from a native colour picker.
 */
export const layoutSchema = z.object({
  name: requiredName(150),
  pageSize: z.enum(PageSize),
  isDefault: z.boolean(),
  primaryColor: z.string(),
  showVitals: z.boolean(),
  showMedicineUrdu: z.boolean(),
  showPatientGender: z.boolean(),
  showDate: z.boolean(),
  clinicName: z.string(),
  clinicNameUrdu: z.string(),
  doctorQualification: z.string(),
  registrationNumber: z.string(),
  doctorPhone: z.string(),
  address: z.string(),
  timings: z.string(),
  phone: z.string(),
  disclaimerText: z.string(),
})

export type LayoutFormValues = z.input<typeof layoutSchema>

/** One medicine row of a preset. Rows without a name are dropped on save. */
const presetMedicineSchema = z.object({
  medicineDirectoryId: z.string().optional(),
  medicineName: max(200),
  medicineNameUrdu: z.string().optional(),
  type: z.string().optional(),
  dosage: max(50),
  frequency: max(100),
  frequencyTiming: z.array(z.string()),
  mealRelation: z.enum(MealRelation),
  duration: max(50),
  specialInstructions: z.string().optional(),
  specialInstructionsUrdu: z.string().optional(),
})

export type PresetMedicineValues = z.input<typeof presetMedicineSchema>

/** A prescription preset: a named set of medicines + instructions. */
export const presetSchema = z
  .object({
    name: requiredName(200),
    category: z.enum(PresetCategory),
    description: z.string(),
    furtherPlan: z.string(),
    instructionsEnglish: z.string(),
    instructionsUrdu: z.string(),
    medicines: z.array(presetMedicineSchema),
  })
  .superRefine((v, ctx) => {
    const named = v.medicines.filter((m) => m.medicineName.trim())
    if (named.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['medicines'],
        message: 'Add at least one medicine',
      })
    } else if (
      !named.every(
        (m) => m.dosage.trim() && m.frequency.trim() && m.duration.trim(),
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['medicines'],
        message: 'Fill in dose, how often and for how long for every medicine',
      })
    }
  })

export type PresetFormValues = z.input<typeof presetSchema>
