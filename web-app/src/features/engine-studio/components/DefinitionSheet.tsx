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
import { useDefinitionForm } from '../hooks/useDefinitionForm'
import type { DefinitionKind } from '../hooks/useDefinitionForm'
import { useFormSchemas, useSpecialties } from '../hooks/useFormSchemas'
import { useWorkflowTemplates } from '../hooks/useWorkflows'
import { NONE, PLATFORM } from '../schemas/studio.schema'
import type { DefinitionFormValues } from '../schemas/studio.schema'
import { ENTITY_TYPE_LABEL, WORKFLOW_ENTITY_TYPES } from '../types'
import type { WorkflowEntityType } from '../types'

const NOUN: Record<DefinitionKind, string> = {
  form: 'form',
  workflow: 'workflow',
}

/**
 * Create a form schema or workflow template. An organization's own copy of
 * a platform default (same code, copied version) overrides it for that
 * organization only.
 */
export function DefinitionSheet({
  open,
  onOpenChange,
  kind,
  preset,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: DefinitionKind
  preset?: Partial<DefinitionFormValues>
  onCreated: (id: string) => void
}) {
  const form = useDefinitionForm({
    open,
    kind,
    preset,
    onDone: (id) => {
      onOpenChange(false)
      onCreated(id)
    },
  })
  const specialties = useSpecialties()
  const organizations = useAuthStore((s) => s.accessibleOrganizations)
  const noun = NOUN[kind]
  const isFork = !!preset?.copyFromVersionId

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={isFork ? `Copy ${noun} for an organization` : `New ${noun}`}
      description={
        isFork
          ? `The organization gets its own ${noun} with the same code — it overrides the platform default for that organization only.`
          : `Starts as draft v1. Publish it from the editor once it has no issues.`
      }
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
                Create {noun}
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
        <FormSection title="Owner">
          <div className="space-y-4">
            <form.Field name="specialtyId">
              {(f) => (
                <FormSelect
                  label="Specialty"
                  required
                  placeholder="Choose a specialty"
                  value={f.state.value}
                  onValueChange={(v) => {
                    f.handleChange(v)
                    form.setFieldValue('copyFromVersionId', NONE)
                  }}
                  options={(specialties.data ?? []).map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  disabled={isFork}
                  error={fieldError(f)}
                />
              )}
            </form.Field>
            <form.Field name="owner">
              {(f) => (
                <FormSelect
                  label="Owner"
                  required
                  value={f.state.value}
                  onValueChange={f.handleChange}
                  options={[
                    { value: PLATFORM, label: 'Platform default (everyone)' },
                    ...organizations.map((o) => ({
                      value: o.id,
                      label: o.name,
                    })),
                  ]}
                  hint={
                    f.state.value === PLATFORM
                      ? 'Every organization uses it unless it has its own copy.'
                      : 'Only this organization uses it, in place of the default with the same code.'
                  }
                />
              )}
            </form.Field>
            {kind === 'workflow' && (
              <form.Field name="entityType">
                {(f) => (
                  <FormSelect
                    label="Runs on"
                    required
                    value={f.state.value}
                    onValueChange={(v) => {
                      f.handleChange(v as WorkflowEntityType)
                      form.setFieldValue('copyFromVersionId', NONE)
                    }}
                    options={WORKFLOW_ENTITY_TYPES.map((t) => ({
                      value: t,
                      label: ENTITY_TYPE_LABEL[t],
                    }))}
                    disabled={isFork}
                  />
                )}
              </form.Field>
            )}
          </div>
        </FormSection>

        <FormSection title="Details">
          <div className="space-y-4">
            <form.Field name="code">
              {(f) => (
                <FieldWrapper
                  label="Code"
                  htmlFor="definition-code"
                  required
                  hint="Saved upper-case, e.g. CROWN. Fixed after creation."
                  error={fieldError(f)}
                >
                  <Input
                    id="definition-code"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                    className="font-mono uppercase"
                    placeholder="CROWN"
                  />
                </FieldWrapper>
              )}
            </form.Field>
            <form.Field name="name">
              {(f) => (
                <FieldWrapper
                  label="Name"
                  htmlFor="definition-name"
                  required
                  error={fieldError(f)}
                >
                  <Input
                    id="definition-name"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                  />
                </FieldWrapper>
              )}
            </form.Field>
            <form.Field name="description">
              {(f) => (
                <FieldWrapper
                  label="Description"
                  htmlFor="definition-description"
                  error={fieldError(f)}
                >
                  <Textarea
                    id="definition-description"
                    rows={2}
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                  />
                </FieldWrapper>
              )}
            </form.Field>
            {!isFork && (
              <form.Subscribe
                selector={(s) =>
                  [s.values.specialtyId, s.values.entityType] as const
                }
              >
                {([specialtyId, entityType]) => (
                  <form.Field name="copyFromVersionId">
                    {(f) => (
                      <CopyFromSelect
                        kind={kind}
                        specialtyId={specialtyId}
                        entityType={entityType}
                        value={f.state.value}
                        onChange={f.handleChange}
                      />
                    )}
                  </form.Field>
                )}
              </form.Subscribe>
            )}
          </div>
        </FormSection>
      </form>
    </FormSheet>
  )
}

/** "Start empty" or a copy of another definition's published version. */
function CopyFromSelect({
  kind,
  specialtyId,
  entityType,
  value,
  onChange,
}: {
  kind: DefinitionKind
  specialtyId: string
  entityType: WorkflowEntityType
  value: string
  onChange: (v: string) => void
}) {
  const forms = useFormSchemas(
    { specialtyId: specialtyId || undefined },
    kind === 'form' && !!specialtyId,
  )
  const workflows = useWorkflowTemplates(
    { specialtyId: specialtyId || undefined, entityType },
    kind === 'workflow' && !!specialtyId,
  )
  const sources = (kind === 'form' ? forms.data : workflows.data) ?? []
  const options = sources
    .filter((s) => s.current)
    .map((s) => ({
      value: s.current!.id,
      label: `${s.code} v${s.current!.versionNo} — ${s.organization?.name ?? 'platform'}`,
    }))
  return (
    <FormSelect
      label="Start from"
      value={value}
      onValueChange={onChange}
      options={[{ value: NONE, label: 'Empty definition' }, ...options]}
      disabled={!specialtyId}
      hint="Copy a published version as the first draft."
    />
  )
}
