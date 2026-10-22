import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PrescriptionBuilder } from '@/features/prescriptions'

export const Route = createFileRoute('/prescriptions/$prescriptionId')({
  // Reading Rx is clinical; `patients.clinical.view` does not imply this feature, so the feature check stays.
  staticData: { can: ['prescriptions.create', 'patients.clinical.view'] },
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <PrescriptionDetailPage />
    </RequireFeaturePage>
  ),
})

function PrescriptionDetailPage() {
  const { prescriptionId } = Route.useParams()
  return (
    <DashboardLayout
      title="Prescription"
      backTo="/prescriptions"
      backLabel="Back to prescriptions"
    >
      <PrescriptionBuilder prescriptionId={prescriptionId} />
    </DashboardLayout>
  )
}
