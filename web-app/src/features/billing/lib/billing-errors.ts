import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

/** Friendly messages for backend billing error codes (plan §7.8, §8.4). */
const MESSAGES: Record<string, string> = {
  BILLING_LOCATION_CODE_MISSING:
    'Set a document code for this location in Billing settings first.',
  BILLING_LOCATION_CODE_LOCKED:
    'The document code is locked after the first invoice.',
  BILLING_SERVICE_INACTIVE: 'This service is no longer offered.',
  BILLING_CHARGE_ALREADY_BILLED:
    'This charge is on an invoice — edit the invoice instead.',
  BILLING_CHARGE_NOT_OPEN:
    'A selected charge has nothing left to pay. Refresh and try again.',
  BILLING_CHARGE_NEEDS_PRICING: 'Some charges still need a price.',
  BILLING_PRICE_CHANGE_NOT_ALLOWED:
    'Only an admin can change a catalog price — give a discount instead.',
  BILLING_DISCOUNT_VALUE_NOT_ALLOWED: 'This discount value is not allowed.',
  BILLING_DISCOUNT_NOTE_REQUIRED: 'This discount needs a note.',
  BILLING_CUSTOM_DISCOUNT_ADMIN_ONLY:
    'Only an admin can give a custom discount.',
  BILLING_PAYMENT_ACCOUNT_INVALID: 'This payment account is not available.',
  BILLING_PAYMENT_ACCOUNT_IS_DEFAULT: 'Choose another default account first.',
  BILLING_REFERENCE_REQUIRED:
    'A reference number is required for this account.',
  BILLING_ALLOCATION_EXCEEDS_BALANCE:
    'An amount is larger than the charge balance.',
  BILLING_ALLOCATION_EXCEEDS_FUNDS:
    'The amounts add up to more than the money received.',
  BILLING_INVOICE_CANCELLED: 'This invoice is cancelled.',
  BILLING_INVOICE_REVISION_CONFLICT:
    'This invoice was changed by someone else. Reload it and try again.',
  BILLING_INVOICE_HAS_PAYMENTS:
    'Unapply its payments before cancelling this invoice.',
  BILLING_REFUND_EXCEEDS_ADVANCE:
    "The refund is larger than the patient's advance.",
  BILLING_REFUND_EXCEEDS_INVOICE_REFUNDABLE:
    'The refund is larger than what can be refunded from this invoice.',
  BILLING_CASH_CLOSE_NOTE_REQUIRED: 'Explain the difference in a note.',
  BILLING_CASH_CLOSE_PERIOD_INVALID:
    'The counter was already closed — open a fresh preview.',
}

/** `{ code, message }` of a billing API error. */
export function billingError(err: unknown): { code?: string; message: string } {
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

export const toastBillingError = (err: unknown) =>
  toast.error(billingError(err).message)

/**
 * Every money mutation invalidates every billing view (plan §8.4.2):
 * patient keys, invoice lists/details, payments, desk, badges, cash close.
 * Billing keys share the `billing` root, so one call covers them all.
 */
export function invalidateBilling(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: ['billing'] })
}

/** A fresh idempotency key per open sheet (plan §8.2.8). */
export function newClientRequestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () =>
        Math.floor(Math.random() * 16).toString(16),
      )
}
