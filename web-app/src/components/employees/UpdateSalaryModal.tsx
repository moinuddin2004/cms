import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
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
import { useSetSalary } from '@/hooks/useEmployees'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const salarySchema = z.object({
  grossSalary: z.coerce.number().min(0, 'Salary must be a positive number'),
  effectiveFrom: z.string().min(1, 'Effective date is required'),
  notes: z.string().optional(),
})

type SalaryFormValues = z.infer<typeof salarySchema>

interface UpdateSalaryModalProps {
  employeeId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  currentSalary?: number
}

export function UpdateSalaryModal({
  employeeId,
  isOpen,
  onOpenChange,
  currentSalary,
}: UpdateSalaryModalProps) {
  const setSalaryMutation = useSetSalary(employeeId)

  const form = useForm<SalaryFormValues>({
    resolver: zodResolver(salarySchema),
    defaultValues: {
      grossSalary: currentSalary || 0,
      effectiveFrom: new Date().toISOString().split('T')[0],
      notes: '',
    },
  })

  async function onSubmit(data: SalaryFormValues) {
    try {
      await setSalaryMutation.mutateAsync(data)
      toast.success('Salary updated')
      onOpenChange(false)
      form.reset()
    } catch (error) {
      toast.error('Failed to update salary')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Salary</DialogTitle>
          <DialogDescription>
            Set new gross salary for this employee
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4"
          >
            <FormField
              control={form.control}
              name="grossSalary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gross Salary (PKR)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        PKR
                      </span>
                      <Input
                        type="number"
                        className="pl-12"
                        placeholder="50000"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="effectiveFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective From</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Annual increment" {...field} />
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
              <Button type="submit" disabled={setSalaryMutation.isPending}>
                {setSalaryMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
