import { toast } from 'sonner'

/** Friendly messages for the backend's payables error codes. */
const MESSAGES: Record<string, string> = {
  STALE_VERSION:
    'This bill changed just now (the order may have new costs). The latest version is loaded — check it and try again.',
  PAYABLES_NOT_ALLOWED: 'That isn’t possible in the current status.',
  PAYABLES_DUPLICATE_INVOICE:
    'This lab invoice number is already on another bill.',
  PAYABLES_ALLOCATION_LIMIT:
    'The amounts are more than the payment or a bill’s balance.',
  REQUEST_IN_FLIGHT: 'Still saving — wait a moment.',
}

interface ApiErrorBody {
  message?: string
  error?: { code?: string; message?: string }
}

export function payablesError(err: unknown): {
  code?: string
  message: string
} {
  const res = (err as { response?: { data?: ApiErrorBody } } | null)?.response
    ?.data
  const code = res?.error?.code
  return {
    code,
    message:
      (code && code !== 'PAYABLES_NOT_ALLOWED' && MESSAGES[code]) ||
      res?.error?.message ||
      (code && MESSAGES[code]) ||
      res?.message ||
      (err instanceof Error ? err.message : '') ||
      'Something went wrong',
  }
}

export const toastPayablesError = (err: unknown) =>
  toast.error(payablesError(err).message)
