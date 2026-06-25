import { createFileRoute } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PrescriptionBuilder } from '@/features/prescriptions'

export const Route = createFileRoute('/prescriptions/$prescriptionId')({
  component: () => (
    <RequireFeaturePage feature="patients.prescriptions">
      <PrescriptionDetailPage />
    </RequireFeaturePage>
  ),
})

function PrescriptionDetailPage() {
  const { prescriptionId } = Route.useParams()
  return (
    <DashboardLayout title="Prescription">
      <PrescriptionBuilder prescriptionId={prescriptionId} />
    </DashboardLayout>
  )
}
