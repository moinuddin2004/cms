import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmployees } from '@/hooks/useEmployees'
import { EmployeeRow } from '@/components/employees/EmployeeRow'
import { EmployeeFilters } from '@/components/employees/EmployeeFilters'
import { useState, useMemo } from 'react'
import { Users, Plus, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'

export const Route = createFileRoute('/employees/')({
  component: EmployeeListPage,
})

function EmployeeListPage() {
  const navigate = useNavigate()
  const { activeLocationId } = useAuthStore()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Simple debouncing logic for search
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useMemo(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const {
    data: employees,
    isLoading,
    isError,
    refetch,
  } = useEmployees({
    search: debouncedSearch,
    role: roleFilter === 'all' ? undefined : roleFilter,
    isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
  })

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
          <Button onClick={() => navigate({ to: '/select-location' })}>
            Select Location
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Employees"
      subtitle="Manage your clinic staff"
      actions={
        <Button onClick={() => navigate({ to: '/employees/create' })}>
          <Plus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      }
    >
      <div className="space-y-6">
        <EmployeeFilters
          search={search}
          setSearch={setSearch}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
        />

        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name + Role</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[150px]" />
                        <Skeleton className="h-3 w-[100px]" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-[70px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-[70px]" />
                    </TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <p className="text-muted-foreground">
                        Something went wrong. Try again.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                      >
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : employees?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="rounded-full bg-muted p-6">
                        <Users className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-medium">
                          No employees found
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Add your first employee to get started
                        </p>
                      </div>
                      <Button
                        onClick={() => navigate({ to: '/employees/create' })}
                      >
                        Add Employee
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                employees?.map((employee: any) => (
                  <EmployeeRow key={employee.id} employee={employee} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  )
}
