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
import { useUpdateSalary } from '../hooks/useSetSalary'
import { salaryFormSchema, type SalaryFormData } from '../types'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

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
  const updateSalaryMutation = useUpdateSalary(employeeId)

  const form = useForm<SalaryFormData>({
    resolver: zodResolver(salaryFormSchema),
    defaultValues: {
      grossSalary: currentSalary || 0,
    },
  })

  async function onSubmit(data: SalaryFormData) {
    try {
      await updateSalaryMutation.mutateAsync(data)
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
            Set new gross salary for this employee at this location
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateSalaryMutation.isPending}
              >
                {updateSalaryMutation.isPending && (
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
