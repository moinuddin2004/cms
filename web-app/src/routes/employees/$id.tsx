import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useEmployee } from '@/hooks/useEmployees'
import { useEmployeePayroll } from '@/hooks/usePayroll'
import {
  formatCurrency,
  formatDate,
  getEmploymentTypeLabel,
} from '@/lib/formatters'
import {
  ChevronLeft,
  Edit,
  Shield,
  ShieldOff,
  Loader2,
  Receipt,
} from 'lucide-react'
import { useState } from 'react'
import { UpdateSalaryModal } from '@/components/employees/UpdateSalaryModal'
import { MarkPaidModal } from '@/components/employees/MarkPaidModal'
import { GeneratePayrollModal } from '@/components/employees/GeneratePayrollModal'
import { PayrollTable } from '@/components/employees/PayrollTable'
import type { PayrollRecord } from '@/types/employee.types'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/employees/$id')({
  component: EmployeeDetailPage,
})

function EmployeeDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { data: employee, isLoading: isEmployeeLoading } = useEmployee(id)
  const { data: payroll, isLoading: isPayrollLoading } = useEmployeePayroll(id)

  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false)
  const [isMarkPaidModalOpen, setIsMarkPaidModalOpen] = useState(false)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(
    null,
  )

  if (isEmployeeLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!employee) {
    return (
      <DashboardLayout title="Employee Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            The employee you are looking for does not exist or you do not have
            permission to view it.
          </p>
          <Button variant="link" onClick={() => navigate({ to: '/employees' })}>
            Back to List
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const currentMonthRecord = payroll?.find(
    (p: PayrollRecord) => p.month === currentMonth && p.year === currentYear,
  )

  return (
    <DashboardLayout
      title={employee.fullName}
      subtitle={employee.designation}
      actions={
        <div className="flex gap-2">
          <Badge
            variant={employee.isActive ? 'outline' : 'secondary'}
            className={cn(
              'pl-1.5 h-8',
              employee.isActive
                ? 'border-green-200 text-green-700'
                : 'border-red-200 text-red-700',
            )}
          >
            <span
              className={cn(
                'mr-1.5 h-1.5 w-1.5 rounded-full',
                employee.isActive ? 'bg-green-500' : 'bg-red-500',
              )}
            />
            {employee.isActive ? 'Active' : 'Inactive'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: `/employees/${id}/edit` })}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Link
          to="/employees"
          className="flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Employees
        </Link>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <InfoItem label="Phone" value={employee.phone} />
                  <InfoItem label="CNIC" value={employee.cnic} />
                  <InfoItem
                    label="Date of Birth"
                    value={employee.dob ? formatDate(employee.dob) : null}
                  />
                  <InfoItem
                    label="Gender"
                    value={employee.gender}
                    className="capitalize"
                  />
                  <InfoItem
                    label="Employment Type"
                    value={
                      <Badge
                        variant="secondary"
                        className="font-normal bg-slate-100"
                      >
                        {getEmploymentTypeLabel(employee.employmentType)}
                      </Badge>
                    }
                  />
                  <InfoItem
                    label="Joining Date"
                    value={formatDate(employee.joiningDate)}
                  />
                  <InfoItem
                    label="Location"
                    value={employee.primaryLocation?.name}
                  />
                  <InfoItem
                    label="Employee Code"
                    value={employee.employeeCode}
                    className="font-mono"
                  />
                  <InfoItem
                    label="Portal Access"
                    value={
                      employee.hasPortalAccess ? (
                        <div className="flex items-center gap-1.5 text-green-600 font-medium text-sm">
                          <Shield size={16} />
                          Has Login Access
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                          <ShieldOff size={16} />
                          No Portal Access
                        </div>
                      )
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">💰 Current Salary</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSalaryModalOpen(true)}
                >
                  {employee.currentSalary ? 'Update' : 'Set Salary'}
                </Button>
              </CardHeader>
              <CardContent>
                {employee.currentSalary ? (
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(employee.currentSalary.grossSalary)}
                    </p>
                    <p className="text-sm text-muted-foreground">per month</p>
                    <div className="pt-4 text-xs text-muted-foreground flex items-center gap-1">
                      Effective since:{' '}
                      {formatDate(employee.currentSalary.effectiveFrom)}
                    </div>
                  </div>
                ) : (
                  <div className="py-4 space-y-2">
                    <p className="text-muted-foreground">
                      No salary configured yet.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Set a salary to enable payroll generation.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payroll" className="mt-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Payroll History</h3>
              {!currentMonthRecord && employee.currentSalary && (
                <Button size="sm" onClick={() => setIsGenerateModalOpen(true)}>
                  Generate This Month
                </Button>
              )}
            </div>

            {isPayrollLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 w-full rounded-md border animate-pulse bg-muted/20"
                  />
                ))}
              </div>
            ) : payroll && payroll.length > 0 ? (
              <PayrollTable
                records={payroll}
                onMarkPaid={(record) => {
                  setSelectedRecord(record)
                  setIsMarkPaidModalOpen(true)
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-4 border rounded-lg bg-slate-50/50">
                <div className="rounded-full bg-white p-6 border shadow-sm">
                  <Receipt className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-medium">No payroll records yet</p>
                  <p className="text-sm text-muted-foreground">
                    Generate payroll to track monthly salaries
                  </p>
                </div>
                {employee.currentSalary && (
                  <Button
                    variant="outline"
                    onClick={() => setIsGenerateModalOpen(true)}
                  >
                    Generate Payroll
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <UpdateSalaryModal
        employeeId={id}
        isOpen={isSalaryModalOpen}
        onOpenChange={setIsSalaryModalOpen}
        currentSalary={employee.currentSalary?.grossSalary}
      />

      <MarkPaidModal
        record={selectedRecord}
        isOpen={isMarkPaidModalOpen}
        onOpenChange={setIsMarkPaidModalOpen}
      />

      <GeneratePayrollModal
        isOpen={isGenerateModalOpen}
        onOpenChange={setIsGenerateModalOpen}
        month={currentMonth}
        year={currentYear}
      />
    </DashboardLayout>
  )
}

function InfoItem({
  label,
  value,
  className,
}: {
  label: string
  value: any
  className?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <div className={cn('text-sm text-foreground font-medium', className)}>
        {value || '—'}
      </div>
    </div>
  )
}
