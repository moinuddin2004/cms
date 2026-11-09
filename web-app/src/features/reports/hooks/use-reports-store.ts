import { create } from 'zustand'
import { dateToYmd, todayYmd, ymdToDate } from '@/lib/datetime'
import type { ReportScopeKind, RevenueBasis } from '../types/reports.types'

export type PeriodPreset =
  'month' | 'lastMonth' | 'quarter' | 'year' | 'lastYear' | 'custom'

interface ReportsFilters {
  preset: PeriodPreset
  custom: { from?: string; to?: string }
  scope: ReportScopeKind
  basis: RevenueBasis
  setPeriod: (
    preset: PeriodPreset,
    custom?: { from?: string; to?: string },
  ) => void
  setScope: (scope: ReportScopeKind) => void
  setBasis: (basis: RevenueBasis) => void
}

/**
 * Period / scope / basis shared by the finance dashboard and every report,
 * so a period picked on the dashboard carries into the report it links to.
 * In memory only (resets on reload).
 */
export const useReportsStore = create<ReportsFilters>((set) => ({
  preset: 'month',
  custom: {},
  scope: 'location',
  basis: 'collected',
  setPeriod: (preset, custom = {}) => set({ preset, custom }),
  setScope: (scope) => set({ scope }),
  setBasis: (basis) => set({ basis }),
}))

const ymd = dateToYmd

export const PERIOD_LABEL: Record<Exclude<PeriodPreset, 'custom'>, string> = {
  month: 'This month',
  lastMonth: 'Last month',
  quarter: 'This quarter',
  year: 'This year',
  lastYear: 'Last year',
}

/**
 * Clinic-local `{from, to}` of a preset. `today` is a calendar-day carrier
 * (defaults to the clinic's today, not the browser's).
 */
export function periodRange(
  preset: PeriodPreset,
  custom: { from?: string; to?: string },
  today = ymdToDate(todayYmd()),
): { from: string; to: string } {
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (preset) {
    case 'month':
      return { from: ymd(new Date(y, m, 1)), to: ymd(today) }
    case 'lastMonth':
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) }
    case 'quarter':
      return { from: ymd(new Date(y, m - (m % 3), 1)), to: ymd(today) }
    case 'year':
      return { from: ymd(new Date(y, 0, 1)), to: ymd(today) }
    case 'lastYear':
      return {
        from: ymd(new Date(y - 1, 0, 1)),
        to: ymd(new Date(y - 1, 11, 31)),
      }
    case 'custom': {
      const from = custom.from ?? ymd(new Date(y, m, 1))
      return { from, to: custom.to ?? from }
    }
  }
}
