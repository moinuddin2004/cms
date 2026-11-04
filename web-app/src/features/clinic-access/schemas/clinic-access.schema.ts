import { z } from 'zod'

const DOMAIN = /^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/

/** "clinic.com, branch.clinic.com" → ['clinic.com', 'branch.clinic.com'] */
export function parseDomains(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
        .filter(Boolean),
    ),
  ]
}

export const signInPolicySchema = z
  .object({
    googleEnabled: z.boolean(),
    requireGoogle: z.boolean(),
    googleDomains: z.string().max(1000, 'Too many domains'),
    joinRequestsEnabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const domains = parseDomains(v.googleDomains)
    const bad = domains.find((d) => !DOMAIN.test(d))
    if (bad) {
      ctx.addIssue({
        code: 'custom',
        path: ['googleDomains'],
        message: `"${bad}" is not a domain name (e.g. myclinic.com)`,
      })
    } else if (domains.length > 20) {
      ctx.addIssue({
        code: 'custom',
        path: ['googleDomains'],
        message: 'At most 20 domains',
      })
    }
    if (v.requireGoogle && !v.googleEnabled) {
      ctx.addIssue({
        code: 'custom',
        path: ['requireGoogle'],
        message: 'Turn on Google sign-in first',
      })
    }
    if (v.joinRequestsEnabled && !v.googleEnabled) {
      ctx.addIssue({
        code: 'custom',
        path: ['joinRequestsEnabled'],
        message: 'Join requests need Google sign-in to be on',
      })
    } else if (v.joinRequestsEnabled && domains.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['joinRequestsEnabled'],
        message: 'Add your Google Workspace domain first',
      })
    }
  })

export type SignInPolicyFormValues = z.input<typeof signInPolicySchema>

export const approveJoinRequestSchema = z.object({
  designation: z
    .string()
    .trim()
    .min(2, 'Enter their job title')
    .max(255, 'At most 255 characters'),
  employmentRoleId: z.string(),
})

export type ApproveJoinRequestFormValues = z.input<
  typeof approveJoinRequestSchema
>

export const clinicApprovalSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    note: z.string().trim().max(1000, 'At most 1000 characters'),
  })
  .refine((v) => v.decision === 'approve' || v.note.length >= 3, {
    path: ['note'],
    message: 'Tell the owner why (they will see this)',
  })

export type ClinicApprovalFormValues = z.input<typeof clinicApprovalSchema>
