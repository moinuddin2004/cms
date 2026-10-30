import { z } from 'zod'
import { OTHER_PROCEDURE } from '../utils/treatmentInput'

/**
 * "Treatment done today" add row. With a service catalog the doctor picks a
 * chip (or "Other…" and types a name); without one they type the name. The
 * tooth is free text — clinics write it their own way ("16", "UR6", "16, 17").
 */
export function makeTreatmentSchema(hasCatalog: boolean) {
  return z
    .object({
      selected: z.string().nullable(),
      name: z.string().trim().max(200, 'At most 200 characters'),
      tooth: z.string().trim().max(50, 'At most 50 characters'),
    })
    .superRefine((v, ctx) => {
      if (hasCatalog && !v.selected) {
        ctx.addIssue({
          code: 'custom',
          path: ['selected'],
          message: 'Pick a procedure',
        })
      }
      const typing = !hasCatalog || v.selected === OTHER_PROCEDURE
      if (typing && !v.name) {
        ctx.addIssue({
          code: 'custom',
          path: ['name'],
          message: 'Procedure is required',
        })
      }
    })
}

export type TreatmentFormValues = z.input<
  ReturnType<typeof makeTreatmentSchema>
>
