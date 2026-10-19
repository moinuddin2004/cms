import { toast } from 'sonner'

const MESSAGES: Record<string, string> = {
  NOTIFICATION_RULE_LOCKED:
    'This notification is mandatory for your team and cannot be switched off.',
  NOTIFICATION_QUIET_HOURS_INVALID: 'Check the quiet hours and try again.',
}

/** Friendly message for a notifications API error. */
export function notificationErrorMessage(err: unknown): string {
  const res = (
    err as {
      response?: {
        data?: { message?: string; error?: { code?: string; message?: string } }
      }
    } | null
  )?.response?.data
  const code = res?.error?.code
  return (
    (code && MESSAGES[code]) ||
    res?.error?.message ||
    res?.message ||
    (err instanceof Error ? err.message : '') ||
    'Something went wrong'
  )
}

export const toastNotificationError = (err: unknown) =>
  toast.error(notificationErrorMessage(err))
