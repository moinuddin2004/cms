import { activeCurrency } from '@/lib/currency'

/** "PKR 12,500" in the active clinic's currency. */
export const formatCurrency = (amount: number) =>
  `${activeCurrency()} ${amount.toLocaleString('en-PK')}`

/** "Nov 2, 2026" in the clinic's timezone (see `@/lib/datetime`). */
export { formatDate } from '@/lib/datetime'

export const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

export const getEmploymentTypeLabel = (type: string) =>
  ({
    full_time: 'Full Time',
    part_time: 'Part Time',
    visiting: 'Visiting',
    contract: 'Contract',
  })[type] ?? type
