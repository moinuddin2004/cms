import { useAccess } from '@/features/access'

/**
 * What the caller may do in lab billing — mirrors the API's `@Can` lists:
 * `lab.billing.manage` runs the desk; undoing money also needs the
 * patient-billing key for that act; settings need `admin.settings.manage`.
 */
export function useLabBillingAccess() {
  const { can, canAll, isLoading } = useAccess()
  return {
    isLoading,
    canBill: can('lab.billing.manage'),
    /** Void an invoice or issue a credit note. */
    canVoid: canAll(['lab.billing.manage', 'billing.invoice.void']),
    /** Reverse a payment or refund advance / credit. */
    canRefund: canAll(['lab.billing.manage', 'billing.refund.issue']),
    canEditSettings: canAll(['lab.billing.manage', 'admin.settings.manage']),
  }
}
