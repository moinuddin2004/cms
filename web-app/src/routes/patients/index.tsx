import { useState, useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePatients } from '@/features/patients/hooks/usePatients'
import { useDeactivatePatient } from '@/features/patients/hooks/useDeactivatePatient'
import { usePatientStore } from '@/store/patient-store'
import { SearchInput } from '@/features/patients/components/SearchInput'
import { FiltersBar } from '@/features/patients/components/FiltersBar'
import { PatientCard } from '@/features/patients/components/PatientCard'
import { PatientTable } from '@/features/patients/components/PatientTable'
import { PatientListHeader } from '@/features/patients/components/PatientListHeader'
import { PaginationBar } from '@/features/patients/components/PaginationBar'
import { CreatePatientModal } from '@/features/patients/components/CreatePatientModal'
import type { PatientListParams } from '@/features/patients/types'
import { Users } from 'lucide-react'

export const Route = createFileRoute('/patients/')({
  component: PatientsListPage,
})

function PatientsListPage() {
  const { viewMode } = usePatientStore()
  const deactivateMutation = useDeactivatePatient()
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Query params state
  const [params, setParams] = useState<PatientListParams>({
    page: 1,
    limit: 10,
    search: '',
    gender: '',
    bloodGroup: '',
    isActive: undefined,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  })

  const { data, isLoading, isError } = usePatients(params)

  const updateParam = useCallback(
    <K extends keyof PatientListParams>(
      key: K,
      value: PatientListParams[K],
    ) => {
      setParams((prev) => ({
        ...prev,
        [key]: value,
        ...(key !== 'page' ? { page: 1 } : {}),
      }))
    },
    [],
  )

  const resetFilters = useCallback(() => {
    setParams((prev) => ({
      ...prev,
      gender: '',
      bloodGroup: '',
      isActive: undefined,
      page: 1,
    }))
  }, [])

  const handleDeactivate = useCallback(
    (id: string) => {
      if (window.confirm('Are you sure you want to deactivate this patient?')) {
        deactivateMutation.mutate(id)
      }
    },
    [deactivateMutation],
  )

  return (
    <DashboardLayout title="Patients">
      <div className="space-y-5">
        {/* Header */}
        <PatientListHeader
          totalCount={data?.total ?? 0}
          onNewPatient={() => setShowCreateModal(true)}
        />

        {/* Search & Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <SearchInput
                value={params.search || ''}
                onChange={(v) => updateParam('search', v)}
              />
              <FiltersBar
                gender={params.gender || ''}
                onGenderChange={(v) => updateParam('gender', v)}
                bloodGroup={params.bloodGroup || ''}
                onBloodGroupChange={(v) => updateParam('bloodGroup', v)}
                status={
                  params.isActive === undefined ? '' : String(params.isActive)
                }
                onStatusChange={(v) =>
                  updateParam('isActive', v === '' ? undefined : v === 'true')
                }
                onReset={resetFilters}
              />
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {isLoading ? (
          <LoadingSkeleton view={viewMode} />
        ) : isError ? (
          <Card>
            <CardContent className="p-12 text-center text-destructive">
              Failed to load patients. Please try again.
            </CardContent>
          </Card>
        ) : data && data.data.length > 0 ? (
          <>
            {viewMode === 'table' ? (
              <PatientTable
                patients={data.data}
                onDeactivate={handleDeactivate}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {data.data.map((patient) => (
                  <PatientCard
                    key={patient.id}
                    patient={patient}
                    onDeactivate={handleDeactivate}
                  />
                ))}
              </div>
            )}

            <PaginationBar
              page={data.page}
              totalPages={data.totalPages}
              limit={data.limit}
              total={data.total}
              onPageChange={(p) => updateParam('page', p)}
              onLimitChange={(l) => {
                setParams((prev) => ({ ...prev, limit: l, page: 1 }))
              }}
            />
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Create Patient Modal */}
      <CreatePatientModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </DashboardLayout>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-3 bg-muted rounded-full mb-4">
          <Users size={32} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          No patients found
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Get started by adding your first patient. Click the "New Patient"
          button above.
        </p>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton({ view }: { view: string }) {
  if (view === 'table') {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-11 h-11 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
