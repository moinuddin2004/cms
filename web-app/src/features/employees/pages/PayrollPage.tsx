import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-md border bg-surface px-2 py-1 shadow-sm">
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
              >
                <SelectTrigger className="h-8 w-[120px] border-0 shadow-none focus:ring-0">
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
              <div className="h-4 w-px bg-border" />
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
                <SelectTrigger className="h-8 w-[80px] border-0 shadow-none focus:ring-0">
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
            </div>
            <Button variant="outline" onClick={openCreate}>
              <Plus className="mr-2 size-4" />
              Create Payroll
            </Button>
            <Button onClick={() => setIsGenerateModalOpen(true)}>
              <Play className="mr-2 size-4" />
              Generate Payroll
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-text-2">Total Payroll</p>
                  {isLoading ? (
                    <Loader2 className="mt-2 size-6 animate-spin text-text-3" />
                  ) : (
                    <h3 className="mt-1 text-2xl font-bold">
                      {formatCurrency(payrollData?.summary.totalAmount || 0)}
                    </h3>
                  )}
                </div>
                <div className="rounded-lg bg-primary-soft p-2">
                  <Coins className="size-5 text-primary-text" />
                </div>
              </div>
              <p className="mt-4 text-xs text-text-3">
                {payrollData?.summary.totalEmployees || 0} employees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-text-2">Paid Amount</p>
              {isLoading ? (
                <Loader2 className="mt-2 size-6 animate-spin text-text-3" />
              ) : (
                <h3 className="mt-1 text-2xl font-bold text-emerald">
                  {formatCurrency(payrollData?.summary.paidAmount || 0)}
                </h3>
              )}
              <p className="mt-4 text-xs text-text-3">
                {payrollData?.summary.paidCount || 0} paid records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-text-2">Pending Amount</p>
              {isLoading ? (
                <Loader2 className="mt-2 size-6 animate-spin text-text-3" />
              ) : (
                <h3 className="mt-1 text-2xl font-bold text-amber">
                  {formatCurrency(payrollData?.summary.pendingAmount || 0)}
                </h3>
              )}
              <p className="mt-4 text-xs text-text-3">
                {payrollData?.summary.pendingCount || 0} pending records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-text-2">On Hold</p>
              {isLoading ? (
                <Loader2 className="mt-2 size-6 animate-spin text-text-3" />
              ) : (
                <h3 className="mt-1 text-2xl font-bold text-danger">
                  {payrollData?.summary.onHoldCount || 0}
                </h3>
              )}
              <p className="mt-4 text-xs text-text-3">Records on hold</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-primary-text" />
              <CardTitle className="text-lg">
                Records for {MONTHS[month - 1]} {year}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
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
