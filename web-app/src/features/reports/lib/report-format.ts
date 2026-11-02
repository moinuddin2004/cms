import { formatCurrency } from '@/lib/formatters'
import { formatYmd } from '@/lib/datetime'
import type { ReportColumnType } from '../types/reports.types'

/** Display text of a report cell (money is rupees). */
export function formatReportValue(
  value: string | number | null | undefined,
  type: ReportColumnType,
): string {
  if (value == null || value === '') return type === 'text' ? '' : '—'
  switch (type) {
    case 'money':
      return formatCurrency(Number(value))
    case 'number':
      return Number(value).toLocaleString('en-PK')
    case 'decimal':
      return Number(value).toFixed(1)
    case 'percent':
      return `${Number(value).toFixed(1)}%`
    case 'date':
      // Calendar date (the backend already resolved it on the clinic's clock).
      return formatYmd(String(value).slice(0, 10), 'dd MMM yyyy')
    default:
      return String(value)
  }
}

/** "PKR 1.2M" / "PKR 450k" for chart axes and tight tiles. */
export function compactMoney(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 10_000_000) return `${sign}${(abs / 10_000_000).toFixed(1)} Cr`
  if (abs >= 100_000) return `${sign}${(abs / 100_000).toFixed(1)} L`
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1_000)}k`
  if (abs >= 1_000) return `${sign}${Number((abs / 1_000).toFixed(1))}k`
  return `${sign}${Math.round(abs)}`
}

/** "01 Oct – 21 Oct 2026". */
export function periodLabel(from: string, to: string): string {
  if (from === to) return formatYmd(to, 'dd MMM yyyy')
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  return `${formatYmd(from, sameYear ? 'dd MMM' : 'dd MMM yyyy')} – ${formatYmd(to, 'dd MMM yyyy')}`
}
