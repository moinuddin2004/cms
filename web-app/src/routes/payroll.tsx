import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLocationPayroll, GeneratePayrollModal, PayrollTable } from '@/features/employees'
import { formatCurrency } from '@/lib/formatters'
import { Coins, Calendar, Loader2, Play } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/payroll')({
  component: PayrollPage,
})

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function PayrollPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)

  const { data: payrollData, isLoading } = useLocationPayroll(month, year)

  return (
    <DashboardLayout
      title="Location Payroll"
      subtitle="Manage monthly payroll for this location"
      actions={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white rounded-md border shadow-sm px-2 py-1">
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger className="w-[120px] h-8 border-0 shadow-none focus:ring-0">
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
            <div className="h-4 w-px bg-border"></div>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
            >
              <SelectTrigger className="w-[80px] h-8 border-0 shadow-none focus:ring-0">
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
          <Button onClick={() => setIsGenerateModalOpen(true)}>
            <Play className="h-4 w-4 mr-2" />
            Generate Payroll
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Payroll
                  </p>
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin mt-2 text-muted-foreground" />
                  ) : (
                    <h3 className="text-2xl font-bold mt-1 text-foreground">
                      {formatCurrency(payrollData?.summary.totalAmount || 0)}
                    </h3>
                  )}
                </div>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Coins className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {payrollData?.summary.totalEmployees || 0} employees
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Paid Amount
                  </p>
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin mt-2 text-muted-foreground" />
                  ) : (
                    <h3 className="text-2xl font-bold mt-1 text-emerald-600">
                      {formatCurrency(payrollData?.summary.paidAmount || 0)}
                    </h3>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {payrollData?.summary.paidCount || 0} paid records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Pending Amount
                  </p>
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin mt-2 text-muted-foreground" />
                  ) : (
                    <h3 className="text-2xl font-bold mt-1 text-amber-600">
                      {formatCurrency(payrollData?.summary.pendingAmount || 0)}
                    </h3>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {payrollData?.summary.pendingCount || 0} pending records
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    On Hold
                  </p>
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin mt-2 text-muted-foreground" />
                  ) : (
                    <h3 className="text-2xl font-bold mt-1 text-red-600">
                      {payrollData?.summary.onHoldCount || 0}
                    </h3>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Records on hold
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payroll Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                Records for {MONTHS[month - 1]} {year}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <PayrollTable 
                records={payrollData?.records || []} 
                showEmployeeName={true}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <GeneratePayrollModal
        isOpen={isGenerateModalOpen}
        onOpenChange={setIsGenerateModalOpen}
      />
    </DashboardLayout>
  )
}
