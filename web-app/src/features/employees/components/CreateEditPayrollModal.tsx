import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Loader2 } from 'lucide-react'
import { useEmployees } from '../hooks/useEmployees'
import { fieldError } from '@/components/forms/fieldError'
import { usePayrollForm } from '../hooks/usePayrollForm'
import { PAYROLL_STATUS_OPTIONS } from '../types'
import type { PayrollStatus, PayrollRecord } from '../types'

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

interface CreateEditPayrollModalProps {
  record: PayrollRecord | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  defaultMonth?: number
  defaultYear?: number
}

export function CreateEditPayrollModal({
  record,
  isOpen,
  onOpenChange,
  defaultMonth,
  defaultYear,
}: CreateEditPayrollModalProps) {
  const { form, isEdit, isPending } = usePayrollForm({
    record,
    isOpen,
    defaultMonth,
    defaultYear,
    onDone: () => onOpenChange(false),
  })
  const now = new Date()

  const { data: employeesPage } = useEmployees({ page: 1, limit: 100 })
  const employees = employeesPage?.data ?? []

  const yearOptions = Array.from(
    { length: 6 },
    (_, i) => now.getFullYear() - 3 + i,
  )

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Payroll Record' : 'Create Payroll Record'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `${record?.employee?.fullName ?? 'Employee'} · ${record?.periodLabel}`
              : 'Manually create a payroll record for an employee.'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4 py-2"
        >
          {isEdit ? (
            <div className="space-y-1">
              <Label>Employee</Label>
              <Input
                value={record?.employee?.fullName ?? '—'}
                disabled
                readOnly
              />
            </div>
          ) : (
            <form.Field name="employeeId">
              {(field) => (
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => {
                      field.handleChange(v)
                      const emp = employees.find((e) => e.id === v)
                      if (emp?.grossSalary != null) {
                        form.setFieldValue(
                          'salaryAmount',
                          String(Number(emp.grossSalary)),
                        )
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.fullName}
                          {emp.employeeCode ? ` (${emp.employeeCode})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldError(field) && (
                    <p className="text-xs text-destructive">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <form.Field name="month">
              {(field) => (
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select
                    clearable={false}
                    value={String(field.state.value)}
                    onValueChange={(v) => field.handleChange(Number(v))}
                  >
                    <SelectTrigger>
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
                </div>
              )}
            </form.Field>
            <form.Field name="year">
              {(field) => (
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select
                    clearable={false}
                    value={String(field.state.value)}
                    onValueChange={(v) => field.handleChange(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <form.Field name="salaryAmount">
              {(field) => (
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {fieldError(field) && (
                    <p className="text-xs text-destructive">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field name="status">
              {(field) => (
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) =>
                      field.handleChange(val as PayrollStatus)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYROLL_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldError(field) && (
                    <p className="text-xs text-destructive">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="notes">
            {(field) => (
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Reason for this payroll (e.g. mid-month joiner, bonus adjustment)…"
                  className="resize-none"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
              </div>
            )}
          </form.Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={isPending || !canSubmit || isSubmitting}
                >
                  {(isPending || isSubmitting) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isEdit ? 'Save Changes' : 'Create Record'}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
