import { z } from 'zod'

/**
 * Create / edit a login. `isEditing`: password may stay blank (keeps the
 * current one). `needsOrganization`: a super admin creating an owner with no
 * active clinic to fall back on must pick the organization.
 */
export function makeUserSchema(ctx: {
  isEditing: boolean
  needsOrganization: boolean
}) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'Name is required')
        .max(255, 'At most 255 characters'),
      email: z
        .string()
        .min(1, 'Email is required')
        .pipe(z.email('Enter a valid email')),
      password: z.string(),
      /** New logins: password, or Google (no password; linked on first sign-in). */
      loginMethod: z.enum(['password', 'google']),
      type: z.string(),
      status: z.string(),
      organizationId: z.string(),
      employeeId: z.string(),
    })
    .superRefine((v, issue) => {
      const passwordNeeded =
        !ctx.isEditing &&
        !(v.loginMethod === 'google' && v.type !== 'super_admin')
      const passwordChecked = passwordNeeded || (ctx.isEditing && !!v.password)
      if (passwordChecked && v.password.length < 8) {
        issue.addIssue({
          code: 'custom',
          path: ['password'],
          message: 'Password must be at least 8 characters',
        })
      }
      if (ctx.isEditing) return
      if (v.type === 'employee' && !v.employeeId) {
        issue.addIssue({
          code: 'custom',
          path: ['employeeId'],
          message: 'Choose the employee',
        })
      }
      if (ctx.needsOrganization && v.type === 'owner' && !v.organizationId) {
        issue.addIssue({
          code: 'custom',
          path: ['organizationId'],
          message: 'Choose the organization',
        })
      }
    })
}

export type UserFormValues = z.input<ReturnType<typeof makeUserSchema>>
