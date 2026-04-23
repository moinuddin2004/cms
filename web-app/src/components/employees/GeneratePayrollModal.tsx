import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useGeneratePayroll } from '@/hooks/usePayroll'
import { useAuthStore } from '@/store/useAuthStore'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface GeneratePayrollModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  month: number
  year: number
}

export function GeneratePayrollModal({
  isOpen,
  onOpenChange,
  month,
  year,
}: GeneratePayrollModalProps) {
  const generateMutation = useGeneratePayroll()
  const { activeLocationId } = useAuthStore()

  const monthName = new Date(year, month - 1).toLocaleString('default', {
    month: 'long',
  })

  async function onGenerate() {
    if (!activeLocationId) return
    try {
      await generateMutation.mutateAsync({
        month,
        year,
        locationId: activeLocationId,
      })
      toast.success(`Payroll generated for ${monthName} ${year}`)
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to generate payroll')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate Payroll</DialogTitle>
          <DialogDescription>
            Generate payroll for {monthName} {year}? This will create pending
            records for all active employees.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={onGenerate} disabled={generateMutation.isPending}>
            {generateMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
