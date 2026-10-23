import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper, FormSheet } from '@/components/shared'
import { fieldError } from '@/features/queue'
import { useLabContactForm } from '../hooks/useLabContactForm'
import type { LabContactFormValues } from '../schemas/lab-portal.schema'
import type { PortalLab } from '../types'

const FIELDS: Array<{
  name: Exclude<keyof LabContactFormValues, 'address'>
  label: string
  type?: string
  inputMode?: 'tel' | 'email'
}> = [
  { name: 'phone', label: 'Phone', type: 'tel', inputMode: 'tel' },
  { name: 'whatsappPhone', label: 'WhatsApp', type: 'tel', inputMode: 'tel' },
  { name: 'email', label: 'Email', type: 'email', inputMode: 'email' },
  { name: 'city', label: 'City' },
]

/** Lab admins edit how clinics and couriers reach the lab. */
export function LabContactSheet({
  open,
  onOpenChange,
  lab,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lab: PortalLab | null
}) {
  const form = useLabContactForm({
    open,
    lab,
    onDone: () => onOpenChange(false),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Edit contact details"
      description="Clinics see these details on their lab list. The lab's name is managed by platform support."
      widthClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting, s.isDirty] as const}
          >
            {([canSubmit, isSubmitting, isDirty]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting || !isDirty}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        {FIELDS.map((cfg) => (
          <form.Field key={cfg.name} name={cfg.name}>
            {(f) => (
              <FieldWrapper
                label={cfg.label}
                htmlFor={`lab-${cfg.name}`}
                error={fieldError(f)}
              >
                <Input
                  id={`lab-${cfg.name}`}
                  type={cfg.type ?? 'text'}
                  inputMode={cfg.inputMode}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>
        ))}
        <form.Field name="address">
          {(f) => (
            <FieldWrapper
              label="Pickup / delivery address"
              htmlFor="lab-address"
              error={fieldError(f)}
            >
              <Textarea
                id="lab-address"
                rows={3}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Subscribe selector={(s) => s.isDirty}>
          {(isDirty) =>
            isDirty ? (
              <p className="text-xs text-amber">You have unsaved changes.</p>
            ) : null
          }
        </form.Subscribe>
      </form>
    </FormSheet>
  )
}
