import { toast } from 'sonner'
import type { OrderIssue } from '../types'

/** Friendly messages for the backend's order error codes. */
const MESSAGES: Record<string, string> = {
  STALE_VERSION:
    'Someone else changed this order just now. The latest version is loaded — try again.',
  LAB_ORDER_NOT_DRAFT:
    'This order was already submitted — change it with a revision.',
  LAB_ORDER_SNAPSHOT_FROZEN:
    'Submitted prices can only change through a revision.',
  LAB_ORDER_CHARGE_DECIDED: 'This charge was already decided.',
  LAB_NOT_LINKED: 'This lab is not active in your lab list yet.',
  LAB_PRICE_MISSING: 'The lab has no price for one of these services today.',
  LAB_SERVICE_INACTIVE: 'The lab no longer offers one of these services.',
  INVALID_TRANSITION:
    'That action isn’t possible in the order’s current status.',
  TRANSITION_FORBIDDEN: 'Your role can’t do that on this order.',
  REQUEST_IN_FLIGHT: 'Still sending — wait a moment.',
}

interface ApiErrorBody {
  message?: string
  error?: { code?: string; message?: string; issues?: OrderIssue[] }
}

/** `{ code, message, issues }` of an order API error. */
export function orderError(err: unknown): {
  code?: string
  message: string
  issues: OrderIssue[]
} {
  const res = (err as { response?: { data?: ApiErrorBody } } | null)?.response
    ?.data
  const code = res?.error?.code
  return {
    code,
    issues: res?.error?.issues ?? [],
    message:
      (code && MESSAGES[code]) ||
      res?.error?.message ||
      res?.message ||
      (err instanceof Error ? err.message : '') ||
      'Something went wrong',
  }
}

export const toastOrderError = (err: unknown) =>
  toast.error(orderError(err).message)
