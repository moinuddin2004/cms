import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PrescriptionsPage } from '@/features/prescriptions/pages/PrescriptionsPage'

export const Route = createFileRoute('/prescriptions/')({
  // Reading Rx is clinical; `patients.clinical.view` does not imply this feature, so the feature check stays.
  staticData: { can: ['prescriptions.create', 'patients.clinical.view'] },
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <DashboardLayout>
        <PrescriptionsPage />
      </DashboardLayout>
    </RequireFeaturePage>
  ),
})
