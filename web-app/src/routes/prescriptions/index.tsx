import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PrescriptionsPage } from '@/features/prescriptions/pages/PrescriptionsPage'

export const Route = createFileRoute('/prescriptions/')({
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <DashboardLayout>
        <PrescriptionsPage />
      </DashboardLayout>
    </RequireFeaturePage>
  ),
})
