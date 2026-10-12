import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DoctorQueuePage } from '@/features/queue'

export const Route = createFileRoute('/queue/doctor')({
  component: () => (
    <RequireFeaturePage feature="appointments.core">
      <DashboardLayout>
        <DoctorQueuePage />
      </DashboardLayout>
    </RequireFeaturePage>
  ),
})
