import { useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Cake,
  Edit,
  Hash,
  IdCard,
  MapPin,
  Phone,
  Receipt,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusBadge,
} from '@/components/shared'
import {
  formatCurrency,
  formatDate,
  getEmploymentTypeLabel,
} from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { nowInClinic } from '@/lib/datetime'
import { CompensationTab } from '@/features/billing'
import { useAccess } from '@/features/access'
import { useEmployee } from '../hooks/useEmployee'
import { useEmployeePayroll } from '../hooks/useEmployeePayroll'
import { EmployeeAvatar } from '../components/EmployeeAvatar'
import { UpdateSalaryModal } from '../components/UpdateSalaryModal'
import { GeneratePayrollModal } from '../components/GeneratePayrollModal'
import { PayrollTable } from '../components/PayrollTable'
import { ScheduleTab } from '../components/ScheduleTab'
import { LeaveTable } from '../components/LeaveTable'
import { AvailabilityOverrideTab } from '../components/AvailabilityOverrideTab'
import { EditEmployeeSheet } from '../components/EditEmployeeSheet'
import { EmployeeLoginCard } from '../components/EmployeeLoginCard'
import type { Employee } from '../types'

export function EmployeeDetailPage({ employeeId }: { employeeId: string }) {
  const navigate = useNavigate()
  const { can } = useAccess()
  const canManage = can('employees.manage')
  const canPayroll = can('payroll.manage')
  const canLeave = can('leave.approve')
  const commissionsOn = can('compensation.manage')
  const employeeQuery = useEmployee(employeeId)
  const employee = employeeQuery.data

  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  if (employeeQuery.isLoading) {
    return (
      <DashboardLayout backTo="/employees" backLabel="Back to employees">
        <LoadingSkeleton variant="detail" />
      </DashboardLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <DashboardLayout
        title="Employee"
        backTo="/employees"
        backLabel="Back to employees"
      >
        <ErrorState
          description="Could not load this employee."
          onRetry={() => void employeeQuery.refetch()}
        />
      </DashboardLayout>
    )
  }

  if (!employee) {
    return (
      <DashboardLayout
        title="Employee not found"
        backTo="/employees"
        backLabel="Back to employees"
      >
        <EmptyState
          icon={Users}
          title="Employee not found"
          description="This employee does not exist or you do not have access to it."
          action={
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/employees' })}
            >
              Back to employees
            </Button>
          }
        />
      </DashboardLayout>
    )
  }

  // Commission-only doctors have no salary but still get payroll.
  const canGenerate =
    !!employee.currentSalary ||
    (!!employee.compensationType && employee.compensationType !== 'SALARY')

  return (
    <DashboardLayout
      title={employee.fullName}
      subtitle={employeeSubtitle(employee)}
      backTo="/employees"
      backLabel="Back to employees"
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge
            status={employee.isActive ? 'active' : 'inactive'}
            className="h-7 px-3"
          />
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      }
    >
      <Tabs defaultValue="details" className="w-full gap-6">
        <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1 bg-muted/50 p-1">
            <TabsTrigger value="details" className="flex-none px-4">
              Details
            </TabsTrigger>
            {commissionsOn && (
              <TabsTrigger value="compensation" className="flex-none px-4">
                Compensation
              </TabsTrigger>
            )}
            <TabsTrigger value="schedule" className="flex-none px-4">
              Schedule
            </TabsTrigger>
            {canLeave && (
              <TabsTrigger value="leave" className="flex-none px-4">
                Leave
              </TabsTrigger>
            )}
            {canPayroll && (
              <TabsTrigger value="payroll" className="flex-none px-4">
                Payroll
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="details">
          <DetailsTab
            employee={employee}
            canManage={canManage}
            onEditSalary={() => setIsSalaryModalOpen(true)}
          />
        </TabsContent>

        {commissionsOn && (
          <TabsContent value="compensation">
            {employee.assignmentId ? (
              <CompensationTab assignmentId={employee.assignmentId} />
            ) : (
              <EmptyState
                icon={Wallet}
                title="No assignment at this location"
                description="Compensation is set per location. Assign this person to the current location first."
              />
            )}
          </TabsContent>
        )}

        <TabsContent value="schedule" className="space-y-6">
          <ScheduleTab employeeId={employeeId} />
          <AvailabilityOverrideTab employeeId={employeeId} />
        </TabsContent>

        {canLeave && (
          <TabsContent value="leave">
            <LeaveTable employeeId={employeeId} />
          </TabsContent>
        )}

        {canPayroll && (
          <TabsContent value="payroll">
            <PayrollSection
              employeeId={employeeId}
              canGenerate={canGenerate}
              onGenerate={() => setIsGenerateModalOpen(true)}
            />
          </TabsContent>
        )}
      </Tabs>

      <UpdateSalaryModal
        employeeId={employeeId}
        isOpen={isSalaryModalOpen}
        onOpenChange={setIsSalaryModalOpen}
        currentSalary={employee.currentSalary?.grossSalary}
      />
      <GeneratePayrollModal
        isOpen={isGenerateModalOpen}
        onOpenChange={setIsGenerateModalOpen}
      />
      <EditEmployeeSheet
        employee={employee}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </DashboardLayout>
  )
}

/** "Doctor · Senior consultant" — role first, designation only when it adds something. */
function employeeSubtitle(employee: Employee): string {
  const role = employee.employmentRole?.name.trim()
  const designation = employee.designation.trim()
  const parts = [role]
  if (designation && designation.toLowerCase() !== role?.toLowerCase())
    parts.push(designation)
  return parts.filter(Boolean).join(' · ')
}

// ─── Details tab ────────────────────────────────────────────────────

function DetailsTab({
  employee,
  canManage,
  onEditSalary,
}: {
  employee: Employee
  canManage: boolean
  onEditSalary: () => void
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <EmployeeAvatar name={employee.fullName} className="size-12" />
            <div className="min-w-0">
              <CardTitle className="truncate text-lg font-medium">
                {employee.fullName}
              </CardTitle>
              <p className="font-mono text-sm text-muted-foreground">
                {employee.employeeCode}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <InfoSection title="Personal">
              <InfoItem icon={Phone} label="Phone" value={employee.phone} />
              <InfoItem icon={IdCard} label="CNIC" value={employee.cnic} />
              <InfoItem
                icon={Cake}
                label="Date of birth"
                value={employee.dob ? formatDate(employee.dob) : null}
              />
              <InfoItem
                icon={UserRound}
                label="Gender"
                value={employee.gender}
                className="capitalize"
              />
            </InfoSection>
            <InfoSection title="Employment">
              <InfoItem
                icon={BadgeCheck}
                label="Role"
                value={employee.employmentRole?.name}
              />
              <InfoItem
                icon={Briefcase}
                label="Designation"
                value={employee.designation}
              />
              <InfoItem
                icon={Users}
                label="Employment type"
                value={
                  <Badge variant="info">
                    {getEmploymentTypeLabel(employee.employmentType)}
                  </Badge>
                }
              />
              <InfoItem
                icon={CalendarDays}
                label="Joining date"
                value={
                  employee.joiningDate ? formatDate(employee.joiningDate) : null
                }
              />
              <InfoItem
                icon={MapPin}
                label="Location"
                value={employee.primaryLocation?.name}
              />
              <InfoItem
                icon={Hash}
                label="Employee code"
                value={employee.employeeCode}
                className="font-mono"
              />
            </InfoSection>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Wallet className="size-5 text-muted-foreground" />
              Current salary
            </CardTitle>
            {canManage && (
              <Button variant="outline" size="sm" onClick={onEditSalary}>
                {employee.currentSalary ? 'Update' : 'Set salary'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {employee.currentSalary ? (
              <div className="space-y-1">
                <p className="text-2xl font-semibold tabular-nums">
                  {formatCurrency(employee.currentSalary.grossSalary)}
                </p>
                <p className="text-sm text-muted-foreground">
                  per month · since{' '}
                  {formatDate(employee.currentSalary.effectiveFrom)}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-sm font-medium">No salary set</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set a salary to enable payroll.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <EmployeeLoginCard employee={employee} canManage={canManage} />
      </div>
    </div>
  )
}

function InfoSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {children}
      </dl>
    </section>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd
          className={cn(
            'truncate text-sm font-medium text-foreground',
            className,
          )}
        >
          {value || <span className="text-muted-foreground">—</span>}
        </dd>
      </div>
    </div>
  )
}

// ─── Payroll tab ────────────────────────────────────────────────────

function PayrollSection({
  employeeId,
  canGenerate,
  onGenerate,
}: {
  employeeId: string
  canGenerate: boolean
  onGenerate: () => void
}) {
  const payrollQuery = useEmployeePayroll(employeeId, true)
  const payroll = payrollQuery.data
  const now = nowInClinic()
  const hasCurrentMonth = payroll?.some(
    (p) => p.month === now.getMonth() + 1 && p.year === now.getFullYear(),
  )

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <Receipt className="size-5 text-muted-foreground" />
            Payroll history
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Monthly pay records for this person.
          </p>
        </div>
        {!hasCurrentMonth && canGenerate && !!payroll?.length && (
          <Button size="sm" onClick={onGenerate}>
            Generate this month
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {payrollQuery.isLoading ? (
          <LoadingSkeleton variant="table" rows={3} />
        ) : payrollQuery.isError ? (
          <ErrorState
            description="Could not load payroll."
            onRetry={() => void payrollQuery.refetch()}
          />
        ) : payroll && payroll.length > 0 ? (
          <PayrollTable records={payroll} />
        ) : (
          <EmptyState
            icon={Receipt}
            title="No payroll records yet"
            description={
              canGenerate
                ? 'Generate payroll to track monthly pay.'
                : 'Set a salary or compensation plan first, then generate payroll.'
            }
            action={
              canGenerate ? (
                <Button size="sm" onClick={onGenerate}>
                  Generate payroll
                </Button>
              ) : undefined
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
