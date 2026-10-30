import { useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Textarea } from '@/components/ui/textarea'
import { fieldError } from '@/components/forms/fieldError'
import { useCommunicationForm } from '../../hooks/useCommunicationForm'
import type { CommDirection, CommPurpose, CommType } from '../../types'
import { Loader2, PhoneCall } from 'lucide-react'

export function CommunicationFormDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false)
  const { form, isPending } = useCommunicationForm({
    patientId,
    onSaved: () => setOpen(false),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PhoneCall size={14} className="mr-2" /> Log Call
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Log Communication</DialogTitle>
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
            <form.Field name="type">
              {(field) => (
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as CommType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Phone Call</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="in_person">In Person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            <form.Field name="direction">
              {(field) => (
                <div className="space-y-2">
                  <Label>Direction</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) =>
                      field.handleChange(v as CommDirection)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">
                        Inbound (From Patient)
                      </SelectItem>
                      <SelectItem value="outbound">
                        Outbound (To Patient)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="purpose">
            {(field) => (
              <div className="space-y-2">
                <Label>Purpose</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as CommPurpose)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment_reminder">
                      Appointment Reminder
                    </SelectItem>
                    <SelectItem value="appointment_confirmation">
                      Appointment Confirmation
                    </SelectItem>
                    <SelectItem value="appointment_cancellation">
                      Appointment Cancellation
                    </SelectItem>
                    <SelectItem value="recall_reminder">
                      Recall Reminder
                    </SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="billing">Billing/Payment</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <form.Field name="subject">
            {(field) => (
              <div className="space-y-2">
                <Label>Subject (Optional)</Label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Summary of call"
                />
                {fieldError(field) && (
                  <p className="text-xs font-medium text-danger">
                    {fieldError(field)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="messageBody">
            {(field) => (
              <div className="space-y-2">
                <Label>Notes / Message Body</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-24 resize-none"
                  placeholder="Details of the communication..."
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
                  Save Log
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
