import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DoctorQueuePage } from '@/features/queue'

export const Route = createFileRoute('/queue/doctor')({
  staticData: { can: 'queue.doctor.own' },
  component: () => (
    <DashboardLayout>
      <DoctorQueuePage />
    </DashboardLayout>
  ),
})
