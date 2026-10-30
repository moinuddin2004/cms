import { useState } from 'react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { fieldError } from '@/components/forms/fieldError'
import {
  emptyMedication,
  usePrescriptionForm,
} from '../../hooks/usePrescriptionForm'
import { Loader2, Plus, Trash2 } from 'lucide-react'

export function PrescriptionFormDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false)
  const { form, isPending } = usePrescriptionForm({
    patientId,
    onSaved: () => setOpen(false),
  })

  /** Plain text input for one optional medicine detail. */
  const medText = (
    idx: number,
    key: 'dosage' | 'frequency' | 'instructions',
    label: string,
    placeholder: string,
    className = 'space-y-1',
  ) => (
    <form.Field name={`medications[${idx}].${key}`}>
      {(field) => (
        <div className={className}>
          <Label className="text-xs">{label}</Label>
          <Input
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder={placeholder}
          />
        </div>
      )}
    </form.Field>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New Rx</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Prescription</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4 pt-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="chiefComplaint">
              {(field) => (
                <div className="space-y-2">
                  <Label>Chief Complaint</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="diagnosis">
              {(field) => (
                <div className="space-y-2">
                  <Label>Diagnosis</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="medications" mode="array">
            {(medsField) => (
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Medications</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => medsField.pushValue({ ...emptyMedication })}
                  >
                    <Plus size={14} className="mr-1" /> Add Medicine
                  </Button>
                </div>

                {medsField.state.value.map((_, idx) => (
                  <div
                    key={idx}
                    className="p-3 border rounded-md space-y-3 bg-muted/20"
                  >
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-semibold">
                        Medicine #{idx + 1}
                      </Label>
                      {medsField.state.value.length > 1 && (
                        <TooltipButton
                          tooltip="Remove medicine"
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-700"
                          onClick={() => medsField.removeValue(idx)}
                        >
                          <Trash2 size={14} />
                        </TooltipButton>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <form.Field name={`medications[${idx}].name`}>
                        {(field) => (
                          <div className="col-span-3 sm:col-span-1 space-y-1">
                            <Label className="text-xs">
                              Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              value={field.state.value}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              onBlur={field.handleBlur}
                              placeholder="Amoxicillin 500mg"
                            />
                            {fieldError(field) && (
                              <p className="text-xs font-medium text-danger">
                                {fieldError(field)}
                              </p>
                            )}
                          </div>
                        )}
                      </form.Field>
                      {medText(idx, 'dosage', 'Dosage', '1 tab')}
                      {medText(idx, 'frequency', 'Frequency', 'TDS (1-1-1)')}
                      {medText(
                        idx,
                        'instructions',
                        'Instructions',
                        'After meals',
                        'col-span-3 space-y-1',
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </form.Field>

          <form.Field name="specialInstructions">
            {(field) => (
              <div className="space-y-2 pt-2 border-t">
                <Label>General Special Instructions</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-20 resize-none"
                  placeholder="e.g., Avoid cold water..."
                />
              </div>
            )}
          </form.Field>

          <div className="flex justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="mr-2"
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting || isPending}
                >
                  {isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Prescription
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
