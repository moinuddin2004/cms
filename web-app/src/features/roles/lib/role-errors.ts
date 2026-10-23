import { toast } from 'sonner'
import { PERMISSIONS } from '@/features/access/generated/catalog'
import type { Permission } from '@/features/access/generated/catalog'

export interface RoleError {
  code?: string
  message: string
  /** ESCALATION / REASON_REQUIRED: the permissions at fault. */
  permissions: Permission[]
  /** ROLE_HAS_MEMBERS: how many active members still use the role. */
  memberCount?: number
}

// The server may name keys this build does not know yet.
const label = (p: Permission) =>
  Object.hasOwn(PERMISSIONS, p) ? PERMISSIONS[p].label : p

/** Reads the backend's `{ error: { code, ... } }` body into a friendly message. */
export function roleError(err: unknown): RoleError {
  const res = (
    err as {
      response?: {
        data?: {
          message?: string
          error?: {
            code?: string
            message?: string
            permissions?: Permission[]
            memberCount?: number
          }
        }
      }
    } | null
  )?.response?.data
  const e = res?.error
  const permissions = Array.isArray(e?.permissions) ? e.permissions : []
  let message =
    e?.message ||
    res?.message ||
    (err instanceof Error ? err.message : '') ||
    'Something went wrong'
  if (e?.code === 'ESCALATION') {
    message = `You can't grant access you don't have yourself: ${permissions.map(label).join(', ')}.`
  } else if (e?.code === 'REASON_REQUIRED') {
    message = `Give a reason to grant: ${permissions.map(label).join(', ')}.`
  } else if (e?.code === 'ROLE_HAS_MEMBERS') {
    const n = e.memberCount ?? 0
    message = `${n} active member${n === 1 ? '' : 's'} still use this role. Move them to another role first.`
  } else if (e?.code === 'SYSTEM_ROLE_READ_ONLY') {
    message = 'System roles are read-only. Clone the role to customise it.'
  }
  return { code: e?.code, message, permissions, memberCount: e?.memberCount }
}

export const toastRoleError = (err: unknown) =>
  toast.error(roleError(err).message)
