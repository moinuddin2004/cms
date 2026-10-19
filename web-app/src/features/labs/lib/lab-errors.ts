import { toast } from 'sonner'

/** Friendly messages for the backend's lab error codes. */
const MESSAGES: Record<string, string> = {
  STALE_VERSION:
    'Someone else changed this just now. The latest version is loaded — try again.',
  LAB_LINK_EXISTS: 'This lab is already in your lab list.',
  LAB_SUSPENDED: 'This lab is suspended on the platform.',
  LAB_LINK_SUSPENDED_BY_OTHER_SIDE:
    'The lab suspended this link — only the lab can reactivate it.',
  LAB_MEMBER_EXISTS: 'This user is already a member of this lab.',
  LAB_OWNER_ORG_NOT_FOUND: 'The selected clinic no longer exists.',
}

/** `{ code, message }` of a lab API error. */
export function labError(err: unknown): { code?: string; message: string } {
  const res = (
    err as {
      response?: {
        data?: { message?: string; error?: { code?: string; message?: string } }
      }
    } | null
  )?.response?.data
  const code = res?.error?.code
  return {
    code,
    message:
      (code && MESSAGES[code]) ||
      res?.error?.message ||
      res?.message ||
      (err instanceof Error ? err.message : '') ||
      'Something went wrong',
  }
}

export const toastLabError = (err: unknown) =>
  toast.error(labError(err).message)
