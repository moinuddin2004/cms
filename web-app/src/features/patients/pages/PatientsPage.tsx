import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileUp, Loader2, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
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
import { EditPatientSheet } from '../components/EditPatientSheet'
import { ImportPatientsSheet } from '../components/ImportPatientsSheet'
import type { Patient, PatientListParams } from '../types'
import { exportPatientsCsv } from '../services/patients.api'
import { Can } from '@/features/access/components/Can'
import { useAccess } from '@/features/access/hooks/useAccess'

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
  const { can } = useAccess()
  const { viewMode, setViewMode } = usePatientStore()
  const statusMutation = useSetPatientStatus()
  const deleteMutation = useDeletePatient()
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null)
  const [editTarget, setEditTarget] = useState<Patient | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [params, setParams] = useState<PatientListParams>(DEFAULT_PARAMS)
  const linkParams = useSearch({ from: '/patients/' })
  const navigate = useNavigate()
  // Quick-search links (`?search=`, `?create=1`) apply once, also when the
  // page is already open, then leave the URL clean.
  useEffect(() => {
    const { search, create } = linkParams
    if (search === undefined && create === undefined) return
    if (search !== undefined)
      setParams((p) => ({ ...p, search, page: 1 }))
    if (create === '1' && can('patients.create')) setShowCreate(true)
    void navigate({ to: '/patients', search: {}, replace: true })
  }, [linkParams.search, linkParams.create])
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const { truncated } = await exportPatientsCsv(params)
      toast.success(
        truncated
          ? 'Export downloaded (first 10,000 patients only)'
          : 'Export downloaded',
      )
    } catch {
      toast.error('Could not export patients')
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading, isError, refetch } = usePatients(params)

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
      search: '',
      gender: '',
      isActive: undefined,
      page: 1,
    }))
  }, [])

  const filtersActive = useMemo(
    () => !!params.search || !!params.gender || params.isActive !== undefined,
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
          <Can perm="patients.export">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || total === 0}
            >
              {exporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Export
            </Button>
          </Can>
          <Can perm="patients.create">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(true)}
            >
              <FileUp className="size-3.5" />
              Import
            </Button>
          </Can>
          <Can perm="patients.create">
            <Button
              onClick={() => setShowCreate(true)}
              id="new-patient-btn"
              size="sm"
            >
              <Plus className="size-3.5" />
              Create
            </Button>
          </Can>
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
            status={
              params.isActive === undefined ? '' : String(params.isActive)
            }
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
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
              pendingStatusId={pendingStatusId}
              serverPagination={
                data
                  ? {
                      page: data.page,
                      pageSize: data.limit,
                      total: data.total,
                      onPageChange: (p) => updateParam('page', p),
                      onPageSizeChange: (l) =>
                        setParams((prev) => ({ ...prev, limit: l, page: 1 })),
                    }
                  : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {patients.map((patient) => (
                <PatientCard
                  key={patient.id}
                  patient={patient}
                  onToggleStatus={handleToggleStatus}
                  onEdit={setEditTarget}
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
            can('patients.create') ? (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="size-4" />
                New Patient
              </Button>
            ) : undefined
          }
        />
      )}

      <CreatePatientModal open={showCreate} onOpenChange={setShowCreate} />

      {can('patients.create') && (
        <ImportPatientsSheet open={showImport} onOpenChange={setShowImport} />
      )}

      {editTarget && (
        <EditPatientSheet
          patient={editTarget}
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
        />
      )}

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
