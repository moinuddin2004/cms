import { z } from 'zod'

const phoneRe = /^\+?[0-9][0-9\s-]{6,18}$/

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => !v || phoneRe.test(v), 'Enter a valid phone number')

const max = (n: number) => z.string().trim().max(n, `At most ${n} characters`)

/** The lab's contact details — what a lab admin may edit. */
export const labContactSchema = z.object({
  phone: optionalPhone,
  whatsappPhone: optionalPhone,
  email: z
    .string()
    .trim()
    .refine((v) => !v || z.email().safeParse(v).success, 'Enter a valid email'),
  city: max(100),
  address: max(500),
})

export type LabContactFormValues = z.input<typeof labContactSchema>

export const portalMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .pipe(z.email('Enter a valid email')),
  role: z.enum(['lab_admin', 'lab_technician']),
})

export type PortalMemberFormValues = z.input<typeof portalMemberSchema>

export const suspendClinicSchema = z.object({
  reason: max(500).min(1, 'A reason is required'),
})
