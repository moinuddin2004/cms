import { useState } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Label } from '@/components/ui/label'
import { nowInClinic } from '@/lib/datetime'
import { useGeneratePayroll } from '../hooks/useGeneratePayroll'
import { toast } from 'sonner'
import { Loader2, Zap, AlertCircle } from 'lucide-react'

interface GeneratePayrollModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

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

export function GeneratePayrollModal({
  isOpen,
  onOpenChange,
}: GeneratePayrollModalProps) {
  const now = nowInClinic()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const generateMutation = useGeneratePayroll()

  async function handleGenerate() {
    try {
      const result = await generateMutation.mutateAsync({ month, year })
      const messages: string[] = []
      if (result.generated > 0)
        messages.push(`${result.generated} payroll records created`)
      if (result.skipped > 0)
        messages.push(`${result.skipped} already existed`)
      if (result.noSalary.length > 0)
        messages.push(`No salary set: ${result.noSalary.join(', ')}`)
      toast.success(messages.join('\n') || 'Payroll generated')
      onOpenChange(false)
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || 'Failed to generate payroll',
      )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Generate Payroll
          </DialogTitle>
          <DialogDescription>
            Generate payroll records for all active employees at this location
            for the selected month.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select
                clearable={false}
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
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
            <div className="space-y-2">
              <Label>Year</Label>
              <Select
                clearable={false}
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: 5 },
                    (_, i) => now.getFullYear() - 2 + i,
                  ).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-amber/20 bg-amber-soft p-3 text-xs text-amber">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Only employees with a salary configured and active at this
              location will have payroll records generated. Existing records for
              the same month are skipped.
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
          >
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
