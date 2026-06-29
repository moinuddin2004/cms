import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AppointmentsPage } from '@/features/appointments/pages/AppointmentsPage'

export const Route = createFileRoute('/appointments')({
  validateSearch: (search: Record<string, unknown>) => ({
    create: search.create === '1' ? ('1' as const) : undefined,
  }),
  component: () => (
    <RequireFeaturePage feature="appointments.core">
      <DashboardLayout>
        <AppointmentsPage />
      </DashboardLayout>
    </RequireFeaturePage>
  ),
})
