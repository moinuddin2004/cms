import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PatientsPage } from '@/features/patients/pages/PatientsPage'

export const Route = createFileRoute('/patients/')({
  component: () => (
    <RequireFeaturePage feature="patients.core">
      <DashboardLayout>
        <PatientsPage />
      </DashboardLayout>
    </RequireFeaturePage>
  ),
})
