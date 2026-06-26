import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AppointmentsPage } from '@/features/appointments/pages/AppointmentsPage'

export const Route = createFileRoute('/appointments')({
  component: () => (
    <RequireFeaturePage feature="appointments.core">
      <DashboardLayout>
        <AppointmentsPage />
      </DashboardLayout>
    </RequireFeaturePage>
  ),
})
