import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import { useFeatures } from '@/context/FeatureFlagsContext'
import * as api from '../services/reports.api'
import type { ExportFormat, ReportQuery } from '../types/reports.types'
import { periodRange, useReportsStore } from './use-reports-store'

export const REPORTS_FEATURE = 'reports.financial'
export const REPORTS_EXPORT_FEATURE = 'reports.exports'
export const REPORTS_CLINICAL_FEATURE = 'reports.clinical'

export const reportKeys = {
  all: ['reports'] as const,
  catalog: (loc: string | null) => ['reports', 'catalog', loc] as const,
  view: (loc: string | null, key: string, q: ReportQuery) =>
    ['reports', 'view', loc, key, q] as const,
  overview: (loc: string | null, q: ReportQuery) =>
    ['reports', 'overview', loc, q] as const,
  clinic: (loc: string | null, q: ReportQuery) =>
    ['reports', 'clinic', loc, q] as const,
}

/** The shared period / scope / basis as API filters. */
export function useReportQuery(): ReportQuery {
  const { preset, custom, scope, basis } = useReportsStore()
  const canSeeAll = useCanSeeAllLocations()
  return useMemo(() => {
    const range = periodRange(preset, custom)
    return { ...range, scope: canSeeAll ? scope : 'location', basis }
  }, [preset, custom, scope, basis, canSeeAll])
}

/** Owners (and super admins) of a multi-location org can view all locations together. */
export function useCanSeeAllLocations(): boolean {
  const { accessibleOrganizations, activeOrganizationId } = useAuthStore()
  const org = accessibleOrganizations.find((o) => o.id === activeOrganizationId)
  return !!org && org.accessSource !== 'employee' && org.locations.length > 1
}

export function useReportCatalog() {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: reportKeys.catalog(activeLocationId),
    queryFn: api.fetchReportCatalog,
    enabled: !!activeLocationId,
    staleTime: 10 * 60_000,
  })
}

/** `ready` = the report's filter spec is known, so `q` is final. */
export function useReport(key: string, q: ReportQuery, ready = true) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: reportKeys.view(activeLocationId, key, q),
    queryFn: () => api.fetchReport(key, q),
    enabled: !!activeLocationId && !!key && ready,
    placeholderData: keepPreviousData,
  })
}

export function useFinanceOverview(q: ReportQuery) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: reportKeys.overview(activeLocationId, q),
    queryFn: () => api.fetchFinanceOverview(q),
    enabled: !!activeLocationId,
    placeholderData: keepPreviousData,
  })
}

export function useClinicOverview(q: ReportQuery) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: reportKeys.clinic(activeLocationId, q),
    queryFn: () => api.fetchClinicOverview(q),
    enabled: !!activeLocationId,
    placeholderData: keepPreviousData,
  })
}

export function errorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const m = (
      err.response?.data as { message?: string | string[] } | undefined
    )?.message
    if (m) return Array.isArray(m) ? m.join(', ') : m
  }
  return err instanceof Error ? err.message : 'Something went wrong.'
}

/** Excel / PDF download with a per-format loading state. */
export function useReportExport() {
  const { features } = useFeatures()
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (key: string, q: ReportQuery, format: ExportFormat) => {
    const id = `${key}:${format}`
    setBusy(id)
    try {
      await api.downloadReport(key, q, format)
      toast.success(
        format === 'xlsx' ? 'Excel file downloaded' : 'PDF downloaded',
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }
  return {
    enabled: features.has(REPORTS_EXPORT_FEATURE),
    run,
    isBusy: (key: string, format?: ExportFormat) =>
      format ? busy === `${key}:${format}` : !!busy?.startsWith(`${key}:`),
  }
}
