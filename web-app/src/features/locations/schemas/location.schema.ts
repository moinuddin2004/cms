import { z } from 'zod'

const phoneRe = /^\+?[0-9][0-9\s-]{6,18}$/

const max = (n: number) => z.string().trim().max(n, `At most ${n} characters`)

/**
 * Location create / edit (mirrors CreateLocationDto / UpdateLocationDto).
 * `requireOrganization` — super admins creating a location must pick the
 * organization it belongs to; everyone else uses the active one.
 */
export function createLocationSchema({
  requireOrganization,
}: {
  requireOrganization: boolean
}) {
  return z
    .object({
      organizationId: z.string(),
      name: max(255).min(1, 'Name is required'),
      code: max(50).min(1, 'Code is required'),
      address: max(1000),
      city: max(100),
      country: max(100),
      phone: z
        .string()
        .trim()
        .refine((v) => !v || phoneRe.test(v), 'Enter a valid phone number'),
      email: z
        .string()
        .trim()
        .refine(
          (v) => !v || z.email().safeParse(v).success,
          'Enter a valid email',
        ),
    })
    .superRefine((v, ctx) => {
      if (requireOrganization && !v.organizationId) {
        ctx.addIssue({
          code: 'custom',
          path: ['organizationId'],
          message: 'Choose an organization',
        })
      }
    })
}

export type LocationFormValues = z.input<
  ReturnType<typeof createLocationSchema>
>
