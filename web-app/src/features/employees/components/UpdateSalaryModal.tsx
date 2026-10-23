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
import { Label } from '@/components/ui/label'
import { useUpdateSalary } from '../hooks/useSetSalary'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { activeCurrency } from '@/lib/currency'

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

  const form = useForm({
    defaultValues: {
      grossSalary: currentSalary || 0,
    },
    onSubmit: async ({ value }) => {
      try {
        await updateSalaryMutation.mutateAsync(value)
        toast.success('Salary updated')
        onOpenChange(false)
        form.reset()
      } catch {
        toast.error('Failed to update salary')
      }
    },
  })

  useEffect(() => {
    if (isOpen) {
      form.setFieldValue('grossSalary', currentSalary || 0)
    }
  }, [isOpen, currentSalary])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Salary</DialogTitle>
          <DialogDescription>
            Set new gross salary for this employee at this location
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4 py-4"
        >
          <form.Field name="grossSalary">
            {(field) => (
              <div className="space-y-2">
                <Label>Gross Salary ({activeCurrency()})</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {activeCurrency()}
                  </span>
                  <Input
                    type="number"
                    className="pl-12"
                    placeholder="50000"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(Number(e.target.value))}
                    onBlur={field.handleBlur}
                  />
                </div>
                {field.state.meta.errors[0] && (
                  <p className="text-xs text-destructive">
                    {String(field.state.meta.errors[0])}
                  </p>
                )}
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
      </DialogContent>
    </Dialog>
  )
}
