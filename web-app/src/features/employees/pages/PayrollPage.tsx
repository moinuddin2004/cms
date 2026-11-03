import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import {
  Calendar,
  CheckCircle,
  Clock,
  Coins,
  Download,
  Loader2,
  PauseCircle,
  Play,
  Plus,
  Receipt,
} from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { nowInClinic } from '@/lib/datetime'
import { PageWrapper } from '@/components/layout/PageWrapper'
import {
  useLocationPayroll,
  GeneratePayrollModal,
  PayrollTable,
  CreateEditPayrollModal,
  useExportPayrollCsv,
} from '@/features/employees'
import type { PayrollRecord } from '@/features/employees'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function PayrollPage() {
  const now = nowInClinic()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null)

  const {
    data: payrollData,
    isLoading,
    isError,
    refetch,
  } = useLocationPayroll(month, year)
  const exportCsv = useExportPayrollCsv()
  const summary = payrollData?.summary
  const records = payrollData?.records ?? []
  const stats = [
    {
      label: 'Total payroll',
      value: formatCurrency(summary?.totalAmount ?? 0),
      hint: `${summary?.totalEmployees ?? 0} employees`,
      icon: Coins,
      tone: 'bg-primary-soft text-primary-text',
    },
    {
      label: 'Paid',
      value: formatCurrency(summary?.paidAmount ?? 0),
      hint: `${summary?.paidCount ?? 0} records`,
      icon: CheckCircle,
      tone: 'bg-emerald-soft text-emerald',
    },
    {
      label: 'Pending',
      value: formatCurrency(summary?.pendingAmount ?? 0),
      hint: `${summary?.pendingCount ?? 0} records`,
      icon: Clock,
      tone: 'bg-amber-soft text-amber',
    },
    {
      label: 'On hold',
      value: String(summary?.onHoldCount ?? 0),
      hint: 'records',
      icon: PauseCircle,
      tone: 'bg-danger-soft text-danger',
    },
  ]

  const openCreate = () => {
    setEditingRecord(null)
    setIsPayrollModalOpen(true)
  }
  const openEdit = (record: PayrollRecord) => {
    setEditingRecord(record)
    setIsPayrollModalOpen(true)
  }

  return (
    <>
      <PageWrapper
        title="Payroll"
        subtitle="Monthly pay records for this location"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exportCsv.isPending || records.length === 0}
              onClick={() => exportCsv.mutate({ month, year })}
            >
              {exportCsv.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="size-3.5" />
              Add record
            </Button>
            <Button size="sm" onClick={() => setIsGenerateModalOpen(true)}>
              <Play className="size-3.5" />
              Generate payroll
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <Select
            clearable={false}
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
          >
            <SelectTrigger className="h-9 w-[120px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((name, idx) => (
                <SelectItem key={idx + 1} value={String(idx + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            clearable={false}
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="h-9 w-[90px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from(
                { length: 5 },
                (_, i) => now.getFullYear() - 2 + i,
              ).map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Same compact strip as the appointments stats */}
        <div className="grid grid-cols-2 divide-x divide-y rounded-xl border bg-card sm:grid-cols-4 sm:divide-y-0">
          {stats.map(({ label, value, hint, icon: Icon, tone }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent/40"
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${tone}`}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 leading-none">
                <p className="truncate text-[11px] font-medium text-text-3">
                  {label}
                </p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-4 w-16" />
                ) : (
                  <p className="mt-1 truncate text-base leading-none font-bold tabular-nums">
                    {value}
                  </p>
                )}
                <p className="mt-1 truncate text-[11px] text-text-3">{hint}</p>
              </div>
            </div>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-medium">
                <Calendar className="size-5 text-muted-foreground" />
                {MONTHS[month - 1]} {year}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {isLoading
                  ? 'Loading records…'
                  : `${records.length} record${records.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingSkeleton variant="table" rows={4} />
            ) : isError ? (
              <ErrorState
                description="Could not load payroll."
                onRetry={() => void refetch()}
              />
            ) : records.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={`No payroll for ${MONTHS[month - 1]} ${year}`}
                description="Generate records for everyone with pay set up, or add one by hand."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={openCreate}>
                      <Plus className="size-3.5" />
                      Add record
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setIsGenerateModalOpen(true)}
                    >
                      <Play className="size-3.5" />
                      Generate payroll
                    </Button>
                  </div>
                }
              />
            ) : (
              <PayrollTable
                records={records}
                showEmployeeName={true}
                onEdit={openEdit}
              />
            )}
          </CardContent>
        </Card>
      </PageWrapper>

      <GeneratePayrollModal
        isOpen={isGenerateModalOpen}
        onOpenChange={setIsGenerateModalOpen}
      />

      <CreateEditPayrollModal
        record={editingRecord}
        isOpen={isPayrollModalOpen}
        onOpenChange={setIsPayrollModalOpen}
        defaultMonth={month}
        defaultYear={year}
      />
    </>
  )
}
