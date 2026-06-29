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
  Pagination,
} from '@/components/shared'
import { usePatients } from '../hooks/usePatients'
import { useDeactivatePatient } from '../hooks/useDeactivatePatient'
import { usePatientStore } from '@/store/patient-store'
import { SearchInput } from '../components/SearchInput'
import { FiltersBar } from '../components/FiltersBar'
import { PatientCard } from '../components/PatientCard'
import { PatientTable } from '../components/PatientTable'
import { CreatePatientModal } from '../components/CreatePatientModal'
import type { PatientListParams } from '../types'

const DEFAULT_PARAMS: PatientListParams = {
  page: 1,
  limit: 10,
  search: '',
  gender: '',
  bloodGroup: '',
  isActive: undefined,
  sortBy: 'createdAt',
  sortOrder: 'DESC',
}

export function PatientsPage() {
  const { viewMode, setViewMode } = usePatientStore()
  const deactivateMutation = useDeactivatePatient()
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
      bloodGroup: '',
      isActive: undefined,
      page: 1,
    }))
  }, [])

  const filtersActive = useMemo(
    () =>
      !!params.search ||
      !!params.gender ||
      !!params.bloodGroup ||
      params.isActive !== undefined,
    [params],
  )

  const handleDeactivate = useCallback(
    (id: string) => {
      if (window.confirm('Are you sure you want to deactivate this patient?')) {
        deactivateMutation.mutate(id)
      }
    },
    [deactivateMutation],
  )

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
            bloodGroup={params.bloodGroup || ''}
            onBloodGroupChange={(v) => updateParam('bloodGroup', v)}
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
            <PatientTable patients={patients} onDeactivate={handleDeactivate} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {patients.map((patient) => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  onDeactivate={handleDeactivate}
                />
              ))}
            </div>
          )}

          {data && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              limit={data.limit}
              total={data.total}
              onPageChange={(p) => updateParam('page', p)}
              onLimitChange={(l) =>
                setParams((prev) => ({ ...prev, limit: l, page: 1 }))
              }
            />
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
    </PageWrapper>
  )
}
