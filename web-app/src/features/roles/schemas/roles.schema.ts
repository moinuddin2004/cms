import { z } from 'zod'

const name = z
  .string()
  .trim()
  .min(2, 'At least 2 characters')
  .max(100, 'At most 100 characters')

/** New custom role (permissions are set on the role page). */
export const createRoleSchema = z.object({
  name,
  description: z.string().trim().max(500, 'At most 500 characters'),
})
export type CreateRoleValues = z.infer<typeof createRoleSchema>

/** Reason for granting high-risk permissions (kept in the audit log). */
export const riskReasonSchema = z
  .string()
  .trim()
  .min(3, 'Say why this role needs high-risk access')
  .max(500, 'At most 500 characters')

/** Clone: the reason is only required when the source has high-risk grants. */
export const cloneRoleSchema = (needsReason: boolean) =>
  z.object({
    name,
    reason: needsReason
      ? riskReasonSchema
      : z.string().max(500, 'At most 500 characters'),
  })
export type CloneRoleValues = z.infer<ReturnType<typeof cloneRoleSchema>>
