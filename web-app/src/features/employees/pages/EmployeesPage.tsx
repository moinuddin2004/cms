import { useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Plus } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageWrapper, ViewToggle } from '@/components/shared'
import { useAuthStore } from '@/store/useAuthStore'
import { useEmployeeStore } from '@/store/employee-store'
import {
  SearchInput,
  FiltersBar,
  EmployeeTable,
  EmployeeCard,
  useEmployees,
  useDeactivateEmployee,
} from '@/features/employees'

export function EmployeesPage() {
  const { activeLocationId } = useAuthStore()
  const { viewMode, setViewMode } = useEmployeeStore()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  const { data: response, isLoading, isError } = useEmployees({
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
      <PageWrapper
        title="Employees"
      >
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-amber-soft p-6">
            <AlertCircle className="size-12 text-amber" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Select a location first</h2>
            <p className="text-text-2">You need to select a clinic location to manage employees.</p>
          </div>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper
      title="Employees"
      subtitle={`${response?.total || 0} employees total`}
      actions={
        <>
          <ViewToggle value={viewMode} onChange={setViewMode} size="sm" />
          <Button asChild size="sm">
            <Link to="/employees/create">
              <Plus className="size-3.5" />
              Create
            </Link>
          </Button>
        </>
      }
    >
      <Card className="py-0">
        <CardContent className="p-2 px-3">
          <div className="flex flex-row items-center justify-between gap-3">
            <SearchInput
              value={search}
              onChange={(val) => { setSearch(val); setPage(1) }}
            />
            <FiltersBar
              role={role}
              onRoleChange={(val) => { setRole(val === 'all' ? '' : val); setPage(1) }}
              employmentType={employmentType}
              onEmploymentTypeChange={(val) => { setEmploymentType(val); setPage(1) }}
              status={status}
              onStatusChange={(val) => { setStatus(val); setPage(1) }}
              onReset={handleResetFilters}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton view={viewMode} />
      ) : isError ? (
        <Card>
          <CardContent className="p-12 text-center text-danger">
            Failed to load employees. Please try again.
          </CardContent>
        </Card>
      ) : response && response.data.length > 0 ? (
        <>
          {viewMode === 'table' ? (
            <EmployeeTable
              employees={response.data}
              onDeactivate={handleDeactivate}
              serverPagination={{
                page: response.page,
                pageSize: response.limit,
                total: response.total,
                onPageChange: setPage,
                onPageSizeChange: (val) => { setLimit(val); setPage(1) },
              }}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {response.data.map((employee) => (
                  <EmployeeCard key={employee.id} employee={employee} onDeactivate={handleDeactivate} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-panel-2 p-3">
              <AlertCircle size={32} className="text-text-3" />
            </div>
            <h3 className="text-lg font-semibold">No employees found</h3>
            <p className="mt-1 max-w-sm text-sm text-text-2">
              Get started by adding your first employee. Click the "Add Employee" button above.
            </p>
          </CardContent>
        </Card>
      )}
    </PageWrapper>
  )
}

function LoadingSkeleton({ view }: { view: string }) {
  if (view === 'table') {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex-1 space-y-1.5">
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
