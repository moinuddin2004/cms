import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePatient } from '@/features/patients/hooks/usePatient'
import { PatientDetailHeader } from '@/features/patients/components/PatientDetailHeader'
import { PatientDetailTabs } from '@/features/patients/components/PatientDetailTabs'

export const Route = createFileRoute('/patients/$patientId/')({
  component: PatientDetailPage,
})

function PatientDetailPage() {
  const { patientId } = Route.useParams()
  const { data: patient, isLoading, isError } = usePatient(patientId)

  return (
    <DashboardLayout title="Patient Details">
      {isLoading ? (
        <DetailSkeleton />
      ) : isError || !patient ? (
        <Card>
          <CardContent className="p-12 text-center text-destructive">
            Failed to load patient details. Please try again.
          </CardContent>
        </Card>
      ) : (
        <>
          <PatientDetailHeader patient={patient} />
          <PatientDetailTabs patient={patient} />
        </>
      )}
    </DashboardLayout>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  )
}
