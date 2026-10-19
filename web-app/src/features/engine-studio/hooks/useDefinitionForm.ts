import { useEffect, useRef } from 'react'
import { useForm } from '@tanstack/react-form'
import { NONE, PLATFORM, definitionSchema } from '../schemas/studio.schema'
import type { DefinitionFormValues } from '../schemas/studio.schema'
import { useCreateFormSchema } from './useFormSchemas'
import { useCreateWorkflowTemplate } from './useWorkflows'

export type DefinitionKind = 'form' | 'workflow'

const defaults = (
  preset: Partial<DefinitionFormValues> | undefined,
): DefinitionFormValues => ({
  specialtyId: '',
  owner: PLATFORM,
  entityType: 'item',
  code: '',
  name: '',
  description: '',
  copyFromVersionId: NONE,
  ...preset,
})

/**
 * Create a form schema or workflow template — a platform default, or an
 * organization's fork (same code + a copied version overrides the default).
 * Re-seeds each time the sheet opens.
 */
export function useDefinitionForm({
  open,
  kind,
  preset,
  onDone,
}: {
  open: boolean
  kind: DefinitionKind
  preset?: Partial<DefinitionFormValues>
  onDone: (id: string) => void
}) {
  const createForm = useCreateFormSchema()
  const createWorkflow = useCreateWorkflowTemplate()
  const form = useForm({
    defaultValues: defaults(preset),
    validators: { onChange: definitionSchema, onSubmit: definitionSchema },
    onSubmit: async ({ value }) => {
      const common = {
        specialtyId: value.specialtyId,
        organizationId: value.owner === PLATFORM ? undefined : value.owner,
        code: value.code.trim().toUpperCase(),
        name: value.name.trim(),
        description: value.description.trim() || null,
        copyFromVersionId:
          value.copyFromVersionId === NONE
            ? undefined
            : value.copyFromVersionId,
      }
      const created =
        kind === 'form'
          ? await createForm.mutateAsync(common)
          : await createWorkflow.mutateAsync({
              ...common,
              entityType: value.entityType,
            })
      onDone(created.id)
    },
  })

  // Seed from the preset only when the sheet opens (callers pass a fresh object).
  const presetRef = useRef(preset)
  presetRef.current = preset
  useEffect(() => {
    if (open) form.reset(defaults(presetRef.current))
  }, [open, form])

  return form
}
