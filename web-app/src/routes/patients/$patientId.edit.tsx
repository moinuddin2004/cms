import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { RequireFeaturePage } from '@/components/feature/RequireFeaturePage'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PatientForm } from '@/features/patients/components/PatientForm'
import { usePatient } from '@/features/patients/hooks/usePatient'
import { useUpdatePatient } from '@/features/patients/hooks/useUpdatePatient'
import type { PatientFormData } from '@/features/patients/types'

export const Route = createFileRoute('/patients/$patientId/edit')({
  component: () => (
    <RequireFeaturePage feature="patients.core">
      <EditPatientPage />
    </RequireFeaturePage>
  ),
})

function EditPatientPage() {
  const { patientId } = Route.useParams()
  const navigate = useNavigate()
  const { data: patient, isLoading, isError } = usePatient(patientId)
  const updateMutation = useUpdatePatient(patientId)

  const handleSubmit = async (data: PatientFormData) => {
    await updateMutation.mutateAsync(data)
    navigate({ to: '/patients/$patientId', params: { patientId } })
  }

  const handleCancel = () => {
    navigate({ to: '/patients/$patientId', params: { patientId } })
  }

  if (isLoading) {
    return (
      <DashboardLayout title="Edit Patient">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (isError || !patient) {
    return (
      <DashboardLayout title="Edit Patient">
        <Card>
          <CardContent className="p-12 text-center text-destructive">
            Failed to load patient. Please try again.
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Edit Patient">
      <div className="max-w-3xl mx-auto">
        <PatientForm
          defaultValues={patient}
          onSubmit={handleSubmit}
          isSubmitting={updateMutation.isPending}
          mode="edit"
          onCancel={handleCancel}
        />
      </div>
    </DashboardLayout>
  )
}
