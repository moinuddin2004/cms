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
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'

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
      <div className="space-y-5">
        <EmployeeListHeader totalCount={response?.total || 0} />

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <SearchInput 
                value={search} 
                onChange={(val) => { setSearch(val); setPage(1); }} 
              />
              <FiltersBar
                role={role}
                onRoleChange={(val) => { setRole(val === 'all' ? '' : val); setPage(1); }}
                employmentType={employmentType}
                onEmploymentTypeChange={(val) => { setEmploymentType(val); setPage(1); }}
                status={status}
                onStatusChange={(val) => { setStatus(val); setPage(1); }}
                onReset={handleResetFilters}
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <LoadingSkeleton view={viewMode} />
        ) : isError ? (
          <Card>
            <CardContent className="p-12 text-center text-destructive">
              Failed to load employees. Please try again.
            </CardContent>
          </Card>
        ) : response && response.data.length > 0 ? (
          <>
            {viewMode === 'table' ? (
              <EmployeeTable
                employees={response.data}
                onDeactivate={handleDeactivate}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {response.data.map((employee) => (
                  <EmployeeCard
                    key={employee.id}
                    employee={employee}
                    onDeactivate={handleDeactivate}
                  />
                ))}
              </div>
            )}

            <PaginationBar
              page={response.page}
              limit={response.limit}
              total={response.total}
              totalPages={Math.ceil(response.total / response.limit)}
              onPageChange={setPage}
              onLimitChange={(val) => { setLimit(val); setPage(1); }}
            />
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </DashboardLayout>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-3 bg-muted rounded-full mb-4">
          <AlertCircle size={32} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          No employees found
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Get started by adding your first employee. Click the "Add Employee" button above.
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

