import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PatientsPage } from '@/features/patients/pages/PatientsPage'

export const Route = createFileRoute('/patients/')({
  staticData: { can: 'patients.view' },
  component: () => (
    <DashboardLayout>
      <PatientsPage />
    </DashboardLayout>
  ),
})
