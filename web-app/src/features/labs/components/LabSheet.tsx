import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  FieldWrapper,
  FormSection,
  FormSelect,
  FormSheet,
} from '@/components/shared'
import { fieldError } from '@/features/queue'
import { useAuthStore } from '@/store/useAuthStore'
import { useLabForm } from '../hooks/useLabForm'
import { LAB_TYPE_LABEL } from '../types'
import type { Lab, LabType } from '../types'

const TYPE_OPTIONS = (Object.keys(LAB_TYPE_LABEL) as LabType[]).map((t) => ({
  value: t,
  label: LAB_TYPE_LABEL[t],
}))

/** Create or edit a lab in the platform directory (super admin). */
export function LabSheet({
  open,
  onOpenChange,
  lab,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lab: Lab | null
}) {
  const { form, isEditing } = useLabForm({
    open,
    lab,
    onDone: () => onOpenChange(false),
  })
  const organizations = useAuthStore((s) => s.accessibleOrganizations)
  const orgOptions = organizations.map((o) => ({ value: o.id, label: o.name }))

  const text = (
    name: 'phone' | 'whatsappPhone' | 'email' | 'city',
    label: string,
    props: { type?: string; inputMode?: 'tel' | 'email'; placeholder?: string },
  ) => (
    <form.Field name={name}>
      {(f) => (
        <FieldWrapper
          label={label}
          htmlFor={`lab-${name}`}
          error={fieldError(f)}
        >
          <Input
            id={`lab-${name}`}
            value={f.state.value}
            onChange={(e) => f.handleChange(e.target.value)}
            onBlur={f.handleBlur}
            {...props}
          />
        </FieldWrapper>
      )}
    </form.Field>
  )

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={isEditing ? 'Edit lab' : 'Add lab'}
      description={
        isEditing
          ? 'Changes show up for every clinic working with this lab.'
          : 'Labs are shared across the platform — one lab can work with many clinics.'
      }
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
                disabled={!canSubmit || isSubmitting || (isEditing && !isDirty)}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isEditing ? 'Save changes' : 'Add lab'}
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <FormSection title="Lab">
          <div className="space-y-4">
            <form.Field name="name">
              {(f) => (
                <FieldWrapper
                  label="Name"
                  htmlFor="lab-name"
                  required
                  error={fieldError(f)}
                >
                  <Input
                    id="lab-name"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    placeholder="e.g. Precision Dental Lab"
                  />
                </FieldWrapper>
              )}
            </form.Field>

            {!isEditing && (
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="labType">
                  {(f) => (
                    <FormSelect
                      label="Type"
                      required
                      value={f.state.value}
                      onValueChange={(v) => f.handleChange(v as LabType)}
                      options={TYPE_OPTIONS}
                      hint={
                        f.state.value === 'internal'
                          ? "A clinic's own lab — only that clinic sees it."
                          : 'Any clinic can add this lab to its list.'
                      }
                    />
                  )}
                </form.Field>
                <form.Subscribe selector={(s) => s.values.labType}>
                  {(labType) =>
                    labType === 'internal' && (
                      <form.Field name="ownerOrganizationId">
                        {(f) => (
                          <FormSelect
                            label="Owner clinic"
                            required
                            placeholder="Choose a clinic"
                            value={f.state.value}
                            onValueChange={f.handleChange}
                            options={orgOptions}
                            error={fieldError(f)}
                          />
                        )}
                      </form.Field>
                    )
                  }
                </form.Subscribe>
              </div>
            )}
          </div>
        </FormSection>

        <FormSection title="Contact">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {text('phone', 'Phone', {
                inputMode: 'tel',
                placeholder: '0300 1234567',
              })}
              {text('whatsappPhone', 'WhatsApp', {
                inputMode: 'tel',
                placeholder: '0300 1234567',
              })}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {text('email', 'Email', { type: 'email', inputMode: 'email' })}
              {text('city', 'City', { placeholder: 'Karachi' })}
            </div>
            <form.Field name="address">
              {(f) => (
                <FieldWrapper
                  label="Address"
                  htmlFor="lab-address"
                  hint="Where couriers pick up and drop off cases."
                  error={fieldError(f)}
                >
                  <Textarea
                    id="lab-address"
                    rows={2}
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                  />
                </FieldWrapper>
              )}
            </form.Field>
          </div>
        </FormSection>
      </form>
    </FormSheet>
  )
}
