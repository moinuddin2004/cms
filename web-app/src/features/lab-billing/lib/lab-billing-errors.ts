/** Friendly messages for the lab billing API's error codes. */
const MESSAGES: Record<string, string> = {
  LAB_BILLING_VERSION_CONFLICT:
    'Someone else changed this invoice just now — reload and try again.',
  LAB_BILLING_ALREADY_BILLED: 'That work is already on another invoice.',
  LAB_BILLING_INVOICE_HAS_MONEY:
    'Payments or credit notes are on this invoice — reverse or credit them instead of voiding.',
  LAB_BILLING_PAYMENT_REFUNDED:
    'Part of this payment was refunded, so it can no longer be reversed.',
  LAB_BILLING_PAYMENT_REVERSED: 'This payment is already reversed.',
  LAB_BILLING_NOTHING_TO_APPLY: 'The patient has no advance to use.',
  IDEMPOTENCY_KEY_REUSED: 'This request was already sent with other details.',
  REQUEST_IN_FLIGHT: 'Still saving — wait a moment.',
}

interface ApiErrorBody {
  message?: string
  error?: { code?: string; message?: string }
}

export function labBillingErrorMessage(err: unknown): string {
  const res = (err as { response?: { data?: ApiErrorBody } } | null)?.response
    ?.data
  const code = res?.error?.code
  return (
    (code && MESSAGES[code]) ||
    res?.error?.message ||
    res?.message ||
    (err instanceof Error ? err.message : '') ||
    'Something went wrong'
  )
}
