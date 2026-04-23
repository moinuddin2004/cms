import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  EmployeeListHeader,
  SearchInput,
  FiltersBar,
  EmployeeTable,
  EmployeeCard,
  PaginationBar,
  useEmployees,
  useDeactivateEmployee,
} from '@/features/employees'
import { useEmployeeStore } from '@/store/employee-store'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import { Loader2, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/employees/')({
  component: EmployeeListPage,
})

function EmployeeListPage() {
  const { activeLocationId } = useAuthStore()
  const { viewMode } = useEmployeeStore()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  const { data: response, isLoading } = useEmployees({
    search,
    role,
    isActive: status === 'true' ? true : status === 'false' ? false : undefined,
    page,
    limit,
  })

  const deactivateMutation = useDeactivateEmployee()

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this employee?')) return
    try {
      await deactivateMutation.mutateAsync(id)
      toast.success('Employee deactivated')
    } catch (error) {
      toast.error('Failed to deactivate employee')
    }
  }

  const handleResetFilters = () => {
    setSearch('')
    setRole('')
    setEmploymentType('')
    setStatus('')
    setPage(1)
  }

  if (!activeLocationId) {
    return (
      <DashboardLayout title="Employees">
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-amber-50 p-6">
            <AlertCircle className="h-12 w-12 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">
              Select a location first
            </h2>
            <p className="text-muted-foreground">
              You need to select a clinic location to manage employees.
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Employees">
      <div className="space-y-6 max-w-7xl mx-auto">
        <EmployeeListHeader totalCount={response?.total || 0} />

        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card p-4 rounded-lg border shadow-sm">
          <SearchInput value={search} onChange={(val) => { setSearch(val); setPage(1); }} />
          <FiltersBar
            role={role}
            onRoleChange={(val) => { setRole(val); setPage(1); }}
            employmentType={employmentType}
            onEmploymentTypeChange={(val) => { setEmploymentType(val); setPage(1); }}
            status={status}
            onStatusChange={(val) => { setStatus(val); setPage(1); }}
            onReset={handleResetFilters}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : viewMode === 'table' ? (
          <EmployeeTable
            employees={response?.data || []}
            onDeactivate={handleDeactivate}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {response?.data.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                onDeactivate={handleDeactivate}
              />
            ))}
          </div>
        )}

        {response && response.total > 0 && (
          <PaginationBar
            page={response.page}
            limit={response.limit}
            total={response.total}
            totalPages={Math.ceil(response.total / response.limit)}
            onPageChange={setPage}
            onLimitChange={(val) => { setLimit(val); setPage(1); }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
