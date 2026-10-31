import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { fieldError } from '@/components/forms/fieldError'
import { NumberInput } from '@/components/forms/NumberInput'
import { useSalaryForm } from '../hooks/useSalaryForm'
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
  const { form, isPending } = useSalaryForm({
    employeeId,
    isOpen,
    currentSalary,
    onDone: () => onOpenChange(false),
  })

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
                  <NumberInput
                    className="pl-12"
                    placeholder="50000"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                </div>
                {fieldError(field) && (
                  <p className="text-xs text-destructive">
                    {fieldError(field)}
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
                  Save Changes
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
