import type { PermissionKey } from '@/features/access'

/** Either discount permission opens the discount actions (any-of). */
export const DISCOUNT_PERMS: readonly PermissionKey[] = [
  'billing.discount.apply',
  'billing.discount.custom',
]

/** Any billing read: the desk, or invoices at some scope (any-of). */
export const BILLING_READ_PERMS: readonly PermissionKey[] = [
  'billing.desk.use',
  'billing.invoice.view',
]
