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
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useForm } from '@tanstack/react-form'
import { useCreateConsent } from '../../hooks/usePatientSubEntities'
import { useAuthStore } from '@/store/useAuthStore'
import { Loader2 } from 'lucide-react'
import { ConsentType } from '../../types'

export function ConsentFormDialog({
  patientId,
  isMinor,
}: {
  patientId: string
  isMinor?: boolean
}) {
  const [open, setOpen] = useState(false)
  const { mutate, isPending } = useCreateConsent()
  const { user } = useAuthStore()

  const form = useForm({
    defaultValues: {
      consentType: ConsentType.GENERAL_DENTISTRY,
      consentText: 'I hereby give my consent for general dental procedures.',
      isAgreed: false,
      signedByName: '',
      signedByType: isMinor ? 'GUARDIAN' : 'PATIENT',
    },
    onSubmit: async ({ value }) => {
      mutate(
        {
          patientId,
          ...value,
          witnessedBy: user?.uuid,
        },
        {
          onSuccess: () => setOpen(false),
        },
      )
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Capture Signature</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
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
                  className="h-24 resize-none"
                />
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="signedByName">
              {(field) => (
                <div className="space-y-2">
                  <Label>Signatory Name</Label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
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

          <form.Field name="isAgreed">
            {(field) => (
              <div className="flex items-center space-x-2 pt-2">
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
            <Button
              type="submit"
              disabled={isPending || !form.state.values.isAgreed}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Consent
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
