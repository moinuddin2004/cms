import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  payrollFormSchema,
  PayrollStatus,
  PAYROLL_STATUS_OPTIONS,
  type PayrollFormData,
  type PayrollRecord,
} from '../types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface CreateEditPayrollModalProps {
  /** null → create mode; a record → edit mode. */
  record: PayrollRecord | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Defaults for the period when creating. */
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

  // Only fetch the employee list when creating (the dropdown is for new records).
  const { data: employeesPage } = useEmployees({ page: 1, limit: 100 })
  const employees = employeesPage?.data ?? []

  const form = useForm<PayrollFormData>({
    resolver: zodResolver(payrollFormSchema),
    defaultValues: {
      employeeId: '',
      month: defaultMonth ?? now.getMonth() + 1,
      year: defaultYear ?? now.getFullYear(),
      salaryAmount: 0,
      status: PayrollStatus.PENDING,
      notes: '',
    },
  })

  // Re-seed the form whenever the dialog opens or the target record changes.
  useEffect(() => {
    if (!isOpen) return
    if (record) {
      form.reset({
        employeeId: record.employeeId,
        month: record.month,
        year: record.year,
        salaryAmount: Number(record.salaryAmount),
        status: record.status,
        notes: record.notes ?? '',
      })
    } else {
      form.reset({
        employeeId: '',
        month: defaultMonth ?? now.getMonth() + 1,
        year: defaultYear ?? now.getFullYear(),
        salaryAmount: 0,
        status: PayrollStatus.PENDING,
        notes: '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, record])

  async function onSubmit(data: PayrollFormData) {
    try {
      if (isEdit && record) {
        await updateMutation.mutateAsync({
          recordId: record.id,
          data: {
            salaryAmount: data.salaryAmount,
            month: data.month,
            year: data.year,
            status: data.status,
            notes: data.notes,
          },
        })
      } else {
        await createMutation.mutateAsync(data)
      }
      onOpenChange(false)
    } catch {
      // Hooks surface the error toast.
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            {isEdit ? (
              <div className="space-y-1">
                <FormLabel>Employee</FormLabel>
                <Input
                  value={record?.employee?.fullName ?? '—'}
                  disabled
                  readOnly
                />
              </div>
            ) : (
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        field.onChange(v)
                        const emp = employees.find((e) => e.id === v)
                        if (emp?.grossSalary != null) {
                          form.setValue('salaryAmount', Number(emp.grossSalary))
                        }
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.fullName}
                            {emp.employeeCode ? ` (${emp.employeeCode})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Month</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MONTHS.map((name, idx) => (
                          <SelectItem key={idx + 1} value={String(idx + 1)}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(Number(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from(
                          { length: 6 },
                          (_, i) => now.getFullYear() - 3 + i,
                        ).map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="salaryAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYROLL_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Reason for this payroll (e.g. mid-month joiner, bonus adjustment)…"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
        </Form>
      </DialogContent>
    </Dialog>
  )
}
