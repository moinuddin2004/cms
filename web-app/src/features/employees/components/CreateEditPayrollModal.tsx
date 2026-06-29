import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
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
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useEmployees } from '../hooks/useEmployees'
import { useCreatePayroll } from '../hooks/useCreatePayroll'
import { useUpdatePayroll } from '../hooks/useUpdatePayroll'
import {
  PayrollStatus,
  PAYROLL_STATUS_OPTIONS,
  type PayrollRecord,
} from '../types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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
  const isEdit = !!record
  const createMutation = useCreatePayroll()
  const updateMutation = useUpdatePayroll()
  const now = new Date()

  const { data: employeesPage } = useEmployees({ page: 1, limit: 100 })
  const employees = employeesPage?.data ?? []

  const form = useForm({
    defaultValues: {
      employeeId: '',
      month: defaultMonth ?? now.getMonth() + 1,
      year: defaultYear ?? now.getFullYear(),
      salaryAmount: 0,
      status: PayrollStatus.PENDING as string,
      notes: '',
    },
    onSubmit: async ({ value }) => {
      try {
        if (isEdit && record) {
          await updateMutation.mutateAsync({
            recordId: record.id,
            data: {
              salaryAmount: value.salaryAmount,
              month: value.month,
              year: value.year,
              status: value.status as PayrollStatus,
              notes: value.notes,
            },
          })
        } else {
          await createMutation.mutateAsync(value as any)
        }
        onOpenChange(false)
      } catch {
        // Hooks surface the error toast.
      }
    },
  })

  useEffect(() => {
    if (!isOpen) return
    form.reset()
    if (record) {
      form.setFieldValue('employeeId', record.employeeId)
      form.setFieldValue('month', record.month)
      form.setFieldValue('year', record.year)
      form.setFieldValue('salaryAmount', Number(record.salaryAmount))
      form.setFieldValue('status', record.status)
      form.setFieldValue('notes', record.notes ?? '')
    } else {
      form.setFieldValue('month', defaultMonth ?? now.getMonth() + 1)
      form.setFieldValue('year', defaultYear ?? now.getFullYear())
    }
  }, [isOpen, record])

  const isPending = createMutation.isPending || updateMutation.isPending

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
                        form.setFieldValue('salaryAmount', Number(emp.grossSalary))
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
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {String(field.state.meta.errors[0])}
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
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    onBlur={field.handleBlur}
                  />
                  {field.state.meta.errors[0] && (
                    <p className="text-xs text-destructive">
                      {String(field.state.meta.errors[0])}
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
                    onValueChange={(val) => field.handleChange(val)}
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
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
