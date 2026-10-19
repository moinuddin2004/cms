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
import { useLabServiceForm } from '../hooks/useLabServiceForm'
import {
  useServiceCategories,
  useServiceDefinitions,
} from '../hooks/usePlatformCatalog'
import { UNIT_TYPE_LABEL } from '../types'
import type { DefinitionRef, LabServiceItem, UnitType } from '../types'

const UNIT_OPTIONS = (Object.keys(UNIT_TYPE_LABEL) as UnitType[]).map((u) => ({
  value: u,
  label: UNIT_TYPE_LABEL[u],
}))

const NONE = '__none__'
const definitionOptions = (rows: DefinitionRef[] | undefined) => [
  { value: NONE, label: 'None' },
  ...(rows ?? []).map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })),
]

/** Create or edit one of a lab's services (platform admin). */
export function LabServiceSheet({
  open,
  onOpenChange,
  labId,
  service,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  labId: string
  service: LabServiceItem | null
}) {
  const { form, isEditing } = useLabServiceForm({
    open,
    labId,
    service,
    onDone: () => onOpenChange(false),
  })
  const categories = useServiceCategories()

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={isEditing ? 'Edit service' : 'Add service'}
      description="What the lab makes, how it is counted, and which form and workflow an order line uses."
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
                {isEditing ? 'Save changes' : 'Add service'}
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
        <FormSection title="Service">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="categoryId">
                {(f) => (
                  <FormSelect
                    label="Category"
                    required
                    placeholder="Choose a category"
                    value={f.state.value}
                    onValueChange={f.handleChange}
                    options={(categories.data ?? []).map((c) => ({
                      value: c.id,
                      label: c.name,
                    }))}
                    error={fieldError(f)}
                  />
                )}
              </form.Field>
              <form.Field name="code">
                {(f) => (
                  <FieldWrapper
                    label="Code"
                    htmlFor="svc-code"
                    required
                    hint={isEditing ? 'Fixed once created.' : 'e.g. ZR_CROWN'}
                    error={fieldError(f)}
                  >
                    <Input
                      id="svc-code"
                      value={f.state.value}
                      disabled={isEditing}
                      onChange={(e) => f.handleChange(e.target.value)}
                      onBlur={f.handleBlur}
                      className="uppercase"
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            </div>
            <form.Field name="name">
              {(f) => (
                <FieldWrapper
                  label="Name"
                  htmlFor="svc-name"
                  required
                  error={fieldError(f)}
                >
                  <Input
                    id="svc-name"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    placeholder="e.g. Zirconia crown"
                  />
                </FieldWrapper>
              )}
            </form.Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="unitType">
                {(f) => (
                  <FormSelect
                    label="Charged"
                    required
                    value={f.state.value}
                    onValueChange={(v) => f.handleChange(v as UnitType)}
                    options={UNIT_OPTIONS}
                  />
                )}
              </form.Field>
              <form.Field name="defaultTurnaroundDays">
                {(f) => (
                  <FieldWrapper
                    label="Turnaround (days)"
                    htmlFor="svc-days"
                    required
                    error={fieldError(f)}
                  >
                    <Input
                      id="svc-days"
                      inputMode="numeric"
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      onBlur={f.handleBlur}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            </div>
            <form.Field name="description">
              {(f) => (
                <FieldWrapper
                  label="Description"
                  htmlFor="svc-description"
                  error={fieldError(f)}
                >
                  <Textarea
                    id="svc-description"
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

        <form.Subscribe selector={(s) => s.values.categoryId}>
          {(categoryId) => (
            <DefinitionFields
              form={form}
              specialtyId={
                categories.data?.find((c) => c.id === categoryId)?.specialtyId
              }
            />
          )}
        </form.Subscribe>
      </form>
    </FormSheet>
  )
}

function DefinitionFields({
  form,
  specialtyId,
}: {
  form: ReturnType<typeof useLabServiceForm>['form']
  specialtyId: string | undefined
}) {
  const defs = useServiceDefinitions(specialtyId)
  const select = (
    name: 'formSchemaId' | 'workflowTemplateId' | 'stageTemplateId',
    label: string,
    rows: DefinitionRef[] | undefined,
    hint: string,
  ) => (
    <form.Field name={name}>
      {(f) => (
        <FormSelect
          label={label}
          hint={hint}
          value={f.state.value || NONE}
          disabled={!specialtyId || defs.isLoading}
          onValueChange={(v) => f.handleChange(v === NONE ? '' : v)}
          options={definitionOptions(rows)}
        />
      )}
    </form.Field>
  )
  return (
    <FormSection title="How orders run">
      <div className="space-y-4">
        {select(
          'formSchemaId',
          'Order form',
          defs.data?.forms,
          'What the doctor fills in for this service.',
        )}
        {select(
          'workflowTemplateId',
          'Item workflow',
          defs.data?.workflows,
          'The status steps an order line goes through.',
        )}
        {select(
          'stageTemplateId',
          'Try-in stages',
          defs.data?.stageTemplates,
          'e.g. metal try-in → bisque → final.',
        )}
      </div>
    </FormSection>
  )
}
