import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { FieldWrapper, FormSelect, FormSheet } from '@/components/shared'
import { fieldError } from '@/features/queue'
import { useMappingForm } from '../hooks/useMappingForm'
import {
  useClinicServices,
  useClinicTreatments,
} from '../hooks/useClinicCatalog'
import { formatMinor } from '../lib/money'

/**
 * Bill a lab service as one of the clinic's treatments. Either side can be
 * pre-picked (from a service row or a treatment).
 */
export function MappingSheet({
  open,
  onOpenChange,
  labServiceId,
  clinicTreatmentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  labServiceId?: string
  clinicTreatmentId?: string
}) {
  const { form } = useMappingForm({
    open,
    initial: { labServiceId, clinicTreatmentId },
    onDone: () => onOpenChange(false),
  })
  const treatments = useClinicTreatments(open)
  const services = useClinicServices({ page: 1, limit: 100 }, open)

  const treatmentOptions = (treatments.data ?? [])
    .filter((t) => t.isActive)
    .map((t) => ({
      value: t.id,
      label: `${t.name} — ${formatMinor(t.priceMinor)}`,
    }))
  const serviceOptions = (services.data?.data ?? []).map((s) => ({
    value: s.id,
    label: `${s.name} · ${s.lab.name}${
      s.mapping && s.id !== labServiceId ? ' (mapped)' : ''
    }`,
  }))

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Map to a treatment"
      description="The treatment's price is what the patient pays for this lab work; the lab's price is your cost."
      widthClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save mapping
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
        <form.Field name="labServiceId">
          {(f) => (
            <FormSelect
              label="Lab service"
              required
              placeholder={services.isLoading ? 'Loading…' : 'Choose a service'}
              value={f.state.value}
              disabled={!!labServiceId}
              onValueChange={f.handleChange}
              options={serviceOptions}
              error={fieldError(f)}
            />
          )}
        </form.Field>
        <form.Field name="clinicTreatmentId">
          {(f) => (
            <FormSelect
              label="Your treatment"
              required
              placeholder={
                treatments.isLoading ? 'Loading…' : 'Choose a treatment'
              }
              value={f.state.value}
              onValueChange={f.handleChange}
              options={treatmentOptions}
              error={fieldError(f)}
              hint={
                !treatments.isLoading && !treatmentOptions.length
                  ? 'Add treatments with prices in Billing settings first.'
                  : 'Patient price at this location.'
              }
            />
          )}
        </form.Field>
        <form.Field name="isDefault">
          {(f) => (
            <FieldWrapper
              label="Default lab for this treatment"
              htmlFor="mapping-default"
              hint="Picked first when a doctor orders this treatment. The first mapping of a treatment is always the default."
            >
              <Switch
                id="mapping-default"
                checked={f.state.value}
                onCheckedChange={f.handleChange}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </form>
    </FormSheet>
  )
}
