import { useRef, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { fieldError } from '@/components/forms/fieldError'
import { useConsentForm } from '../../hooks/useConsentForm'
import { Loader2 } from 'lucide-react'
import { ConsentType } from '../../types'
import { SignaturePad } from '@/components/shared/SignaturePad'
import type { SignaturePadHandle } from '@/components/shared/SignaturePad'

export function ConsentFormDialog({
  patientId,
  isMinor,
}: {
  patientId: string
  isMinor?: boolean
}) {
  const [open, setOpen] = useState(false)
  const sigRef = useRef<SignaturePadHandle>(null)
  const { form, isPending } = useConsentForm({
    patientId,
    isMinor,
    sigRef,
    onSaved: () => setOpen(false),
  })

  const busy = isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Capture Signature</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Capture Consent</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4 pt-4"
        >
          <form.Field name="consentType">
            {(field) => (
              <div className="space-y-2">
                <Label>Consent Type</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as ConsentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(ConsentType).map((v) => (
                      <SelectItem key={v} value={v} className="capitalize">
                        {v.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>

          <form.Field name="consentText">
            {(field) => (
              <div className="space-y-2">
                <Label>Consent Terms</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="h-24 resize-none"
                />
                {fieldError(field) && (
                  <p className="text-xs font-medium text-danger">
                    {fieldError(field)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="signedByName">
              {(field) => (
                <div className="space-y-2">
                  <Label>
                    Signatory Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  {fieldError(field) && (
                    <p className="text-xs font-medium text-danger">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="signedByType">
              {(field) => (
                <div className="space-y-2">
                  <Label>Signatory Type</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PATIENT">Patient</SelectItem>
                      <SelectItem value="GUARDIAN">Guardian</SelectItem>
                      <SelectItem value="REPRESENTATIVE">
                        Representative
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          </div>

          {/* Signature pad */}
          <div className="space-y-2">
            <Label>
              Signature <span className="text-destructive">*</span>
            </Label>
            <SignaturePad ref={sigRef} disabled={busy} />
          </div>

          <form.Field name="isAgreed">
            {(field) => (
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="isAgreed"
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(!!v)}
                />
                <Label htmlFor="isAgreed" className="text-sm font-normal">
                  I agree to the terms and conditions outlined above.
                </Label>
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
              selector={(s) =>
                [s.canSubmit, s.isSubmitting, s.values.isAgreed] as const
              }
            >
              {([canSubmit, isSubmitting, isAgreed]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting || busy || !isAgreed}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Consent
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
