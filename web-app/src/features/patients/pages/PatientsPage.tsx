import { useCallback, useMemo, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  PageWrapper,
  ViewToggle,
  EmptyState,
  ErrorState,
  NoResultsState,
  LoadingSkeleton,
} from '@/components/shared'
import { usePatients } from '../hooks/usePatients'
import { useSetPatientStatus } from '../hooks/useSetPatientStatus'
import { useDeletePatient } from '../hooks/useDeletePatient'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { usePatientStore } from '@/store/patient-store'
import { SearchInput } from '../components/SearchInput'
import { FiltersBar } from '../components/FiltersBar'
import { PatientCard } from '../components/PatientCard'
import { PatientTable } from '../components/PatientTable'
import { CreatePatientModal } from '../components/CreatePatientModal'
import type { Patient, PatientListParams } from '../types'

const DEFAULT_PARAMS: PatientListParams = {
  page: 1,
  limit: 10,
  search: '',
  gender: '',
  isActive: undefined,
  sortBy: 'createdAt',
  sortOrder: 'DESC',
}

export function PatientsPage() {
  const { viewMode, setViewMode } = usePatientStore()
  const statusMutation = useSetPatientStatus()
  const deleteMutation = useDeletePatient()
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [params, setParams] = useState<PatientListParams>(DEFAULT_PARAMS)

  const { data, isLoading, isError, refetch } = usePatients(params)

  const updateParam = useCallback(
    <K extends keyof PatientListParams>(key: K, value: PatientListParams[K]) => {
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
      search: '',
      gender: '',
      isActive: undefined,
      page: 1,
    }))
  }, [])

  const filtersActive = useMemo(
    () =>
      !!params.search ||
      !!params.gender ||
      params.isActive !== undefined,
    [params],
  )

  const handleToggleStatus = useCallback(
    (patient: Patient, isActive: boolean) => {
      statusMutation.mutate({ id: patient.id, isActive })
    },
    [statusMutation],
  )

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    })
  }, [deleteMutation, deleteTarget])

  const pendingStatusId = statusMutation.isPending
    ? statusMutation.variables.id
    : null

  const patients = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <PageWrapper
      title="Patients"
      subtitle={`${total} patient${total !== 1 ? 's' : ''} total`}
      actions={
        <>
          <ViewToggle value={viewMode} onChange={setViewMode} size="sm" />
          <Button onClick={() => setShowCreate(true)} id="new-patient-btn" size="sm">
            <Plus className="size-3.5" />
            Create
          </Button>
        </>
      }
    >
      <Card className="py-0">
        <CardContent className="flex flex-row items-center gap-3 p-2 px-3">
          <SearchInput
            value={params.search || ''}
            onChange={(v) => updateParam('search', v)}
          />
          <FiltersBar
            gender={params.gender || ''}
            onGenderChange={(v) => updateParam('gender', v)}
            status={params.isActive === undefined ? '' : String(params.isActive)}
            onStatusChange={(v) =>
              updateParam('isActive', v === '' ? undefined : v === 'true')
            }
            onReset={resetFilters}
          />
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton variant={viewMode === 'table' ? 'table' : 'cards'} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : patients.length > 0 ? (
        <>
          {viewMode === 'table' ? (
            <PatientTable
              patients={patients}
              onToggleStatus={handleToggleStatus}
              onDelete={setDeleteTarget}
              pendingStatusId={pendingStatusId}
              serverPagination={data ? {
                page: data.page,
                pageSize: data.limit,
                total: data.total,
                onPageChange: (p) => updateParam('page', p),
                onPageSizeChange: (l) => setParams((prev) => ({ ...prev, limit: l, page: 1 })),
              } : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {patients.map((patient) => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  onToggleStatus={handleToggleStatus}
                  onDelete={setDeleteTarget}
                  isStatusPending={pendingStatusId === patient.id}
                />
              ))}
            </div>
          )}
        </>
      ) : filtersActive ? (
        <NoResultsState onClear={resetFilters} />
      ) : (
        <EmptyState
          icon={Users}
          title="No patients yet"
          description="Get started by registering your first patient."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="size-4" />
              New Patient
            </Button>
          }
        />
      )}

      <CreatePatientModal open={showCreate} onOpenChange={setShowCreate} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete patient permanently?"
        description={
          <>
            <strong>{deleteTarget?.fullName}</strong> and all of their records
            (appointments, invoices, payments, prescriptions, clinical notes)
            will be permanently deleted. This cannot be undone. To keep the
            records, deactivate the patient instead.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </PageWrapper>
  )
}
