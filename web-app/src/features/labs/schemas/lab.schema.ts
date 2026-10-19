import { z } from 'zod'

const phoneRe = /^\+?[0-9][0-9\s-]{6,18}$/

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => !v || phoneRe.test(v), 'Enter a valid phone number')

const max = (n: number) => z.string().trim().max(n, `At most ${n} characters`)

/** Platform lab (create + edit). Type and owner are fixed after creation. */
export const labSchema = z
  .object({
    name: max(150).min(1, 'Name is required'),
    labType: z.enum(['external', 'internal']),
    ownerOrganizationId: z.string(),
    phone: optionalPhone,
    whatsappPhone: optionalPhone,
    email: z
      .string()
      .trim()
      .refine(
        (v) => !v || z.email().safeParse(v).success,
        'Enter a valid email',
      ),
    city: max(100),
    address: max(500),
  })
  .superRefine((v, ctx) => {
    if (v.labType === 'internal' && !v.ownerOrganizationId) {
      ctx.addIssue({
        code: 'custom',
        path: ['ownerOrganizationId'],
        message: 'Choose the clinic that owns this lab',
      })
    }
  })

export type LabFormValues = z.input<typeof labSchema>

export const labMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .pipe(z.email('Enter a valid email')),
  role: z.enum(['lab_admin', 'lab_technician']),
})

export type LabMemberFormValues = z.input<typeof labMemberSchema>

/** A clinic's terms with a lab. `labId` is only picked when adding. */
export const labLinkSchema = z.object({
  labId: z.string(),
  paymentTermsDays: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, 'Enter whole days')
    .refine((v) => Number(v) <= 365, 'At most 365 days'),
  patientDataLevel: z.enum(['full_name', 'code_only']),
  notes: max(1000),
})

export type LabLinkFormValues = z.input<typeof labLinkSchema>

export const reasonSchema = z.object({
  reason: max(500).min(1, 'A reason is required'),
})
