import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/useAuthStore'
import { fetchPatients } from '@/features/patients/services/patients.api'
import { fetchEmployees } from '@/features/employees/services/employees.api'
import {
  fetchAppointmentStats,
  fetchAppointments,
} from '@/features/appointments/services/appointments.api'
import { fetchInvoiceStats } from '@/features/billing/services/billing.api'

/**
 * Dashboard analytics hooks.
 *
 * These compose the existing real REST endpoints (patients, employees,
 * appointments, invoices) into the numbers the dashboard needs. Every query
 * is gated on an active location and uses `retry: false` so a feature-gated
 * 403 (e.g. financial features disabled for the org) degrades the single
 * widget instead of breaking the whole page.
 */

/** Total active patients in the organization. */
export function usePatientCount(enabled = true) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: ['dashboard', 'patient-count', activeLocationId],
    queryFn: async () => {
      const res = await fetchPatients({ page: 1, limit: 1, isActive: true })
      return res.total
    },
    enabled: enabled && !!activeLocationId,
    retry: false,
    staleTime: 60_000,
  })
}

/** Total active staff members. */
export function useStaffCount() {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: ['dashboard', 'staff-count', activeLocationId],
    queryFn: async () => {
      const res = await fetchEmployees({ page: 1, limit: 1, isActive: true })
      return res.total
    },
    enabled: !!activeLocationId,
    retry: false,
    staleTime: 60_000,
  })
}

/** Appointment stats for an arbitrary date window (ISO strings). */
export function useAppointmentStats(
  startDate: string,
  endDate: string,
  bucket: string,
  enabled = true,
) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: ['dashboard', 'appt-stats', activeLocationId, bucket],
    queryFn: () => fetchAppointmentStats(startDate, endDate),
    enabled: enabled && !!activeLocationId,
    retry: false,
    staleTime: 30_000,
  })
}

/** Outstanding / overdue / revenue invoice rollup. */
export function useInvoiceStats(enabled = true) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: ['dashboard', 'invoice-stats', activeLocationId],
    queryFn: fetchInvoiceStats,
    enabled: enabled && !!activeLocationId,
    retry: false,
    staleTime: 60_000,
  })
}

/** Today's appointment schedule (up to `limit` rows). */
export function useTodayAppointments(
  startDate: string,
  endDate: string,
  limit = 8,
  enabled = true,
) {
  const { activeLocationId } = useAuthStore()
  return useQuery({
    queryKey: ['dashboard', 'today-appts', activeLocationId, startDate, limit],
    queryFn: () => fetchAppointments({ startDate, endDate, page: 1, limit }),
    enabled: enabled && !!activeLocationId,
    retry: false,
    staleTime: 30_000,
  })
}
