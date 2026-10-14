import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Coins, Calendar, Loader2, Play, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { PageWrapper } from '@/components/layout/PageWrapper'
import {
  useLocationPayroll,
  GeneratePayrollModal,
  PayrollTable,
  CreateEditPayrollModal,
} from '@/features/employees'
import type { PayrollRecord } from '@/features/employees'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function PayrollPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<PayrollRecord | null>(null)

  const { data: payrollData, isLoading } = useLocationPayroll(month, year)

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
        title="Location Payroll"
        subtitle="Manage monthly payroll for this location"
        actions={
          <div className="flex items-center gap-2">
            <Select
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
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
            >
              <SelectTrigger className="h-9 w-[90px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(
                  (y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="size-3.5" />
              Create Payroll
            </Button>
            <Button size="sm" onClick={() => setIsGenerateModalOpen(true)}>
              <Play className="size-3.5" />
              Generate Payroll
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-text-2">Total Payroll</p>
                  {isLoading ? (
                    <Loader2 className="mt-1 size-4 animate-spin text-text-3" />
                  ) : (
                    <h3 className="mt-0.5 text-base font-bold">
                      {formatCurrency(payrollData?.summary.totalAmount || 0)}
                    </h3>
                  )}
                </div>
                <div className="rounded-md bg-primary-soft p-1">
                  <Coins className="size-3.5 text-primary-text" />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-text-3">
                {payrollData?.summary.totalEmployees || 0} employees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-[11px] font-medium text-text-2">Paid Amount</p>
              {isLoading ? (
                <Loader2 className="mt-1 size-4 animate-spin text-text-3" />
              ) : (
                <h3 className="mt-0.5 text-base font-bold text-emerald">
                  {formatCurrency(payrollData?.summary.paidAmount || 0)}
                </h3>
              )}
              <p className="mt-2 text-[11px] text-text-3">
                {payrollData?.summary.paidCount || 0} paid records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-[11px] font-medium text-text-2">Pending Amount</p>
              {isLoading ? (
                <Loader2 className="mt-1 size-4 animate-spin text-text-3" />
              ) : (
                <h3 className="mt-0.5 text-base font-bold text-amber">
                  {formatCurrency(payrollData?.summary.pendingAmount || 0)}
                </h3>
              )}
              <p className="mt-2 text-[11px] text-text-3">
                {payrollData?.summary.pendingCount || 0} pending records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-[11px] font-medium text-text-2">On Hold</p>
              {isLoading ? (
                <Loader2 className="mt-1 size-4 animate-spin text-text-3" />
              ) : (
                <h3 className="mt-0.5 text-base font-bold text-danger">
                  {payrollData?.summary.onHoldCount || 0}
                </h3>
              )}
              <p className="mt-2 text-[11px] text-text-3">Records on hold</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-primary-text" />
          <h3 className="text-sm font-semibold">
            Records for {MONTHS[month - 1]} {year}
          </h3>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-8 animate-spin text-text-3" />
          </div>
        ) : (
          <PayrollTable
            records={payrollData?.records || []}
            showEmployeeName={true}
            onEdit={openEdit}
          />
        )}

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
