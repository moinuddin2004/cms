import { useEffect, useRef } from 'react'
import { useForm } from '@tanstack/react-form'
import { PLATFORM, stageTemplateSchema } from '../schemas/studio.schema'
import type {
  StageStepFormValues,
  StageTemplateFormValues,
} from '../schemas/studio.schema'
import type { StageStep, StageTemplate } from '../types'
import { useSaveStageTemplate } from './useStageTemplates'

export const blankStep = (): StageStepFormValues => ({
  code: '',
  name: '',
  requiresPatientVisit: false,
  requiresDoctorApproval: false,
  defaultLabDays: '3',
})

function defaultsFor(t: StageTemplate | null): StageTemplateFormValues {
  return {
    specialtyId: t?.specialty.id ?? '',
    owner: t?.organization?.id ?? PLATFORM,
    code: t?.code ?? '',
    name: t?.name ?? '',
    isActive: t?.isActive ?? true,
    steps: t
      ? [...t.steps]
          .sort((a, b) => a.seq - b.seq)
          .map((s) => ({
            code: s.code,
            name: s.name,
            requiresPatientVisit: s.requiresPatientVisit,
            requiresDoctorApproval: s.requiresDoctorApproval,
            defaultLabDays: String(s.defaultLabDays),
          }))
      : [blankStep()],
  }
}

const toSteps = (steps: StageStepFormValues[]): StageStep[] =>
  steps.map((s) => ({
    code: s.code.trim().toLowerCase(),
    name: s.name.trim(),
    requiresPatientVisit: s.requiresPatientVisit,
    requiresDoctorApproval: s.requiresDoctorApproval,
    defaultLabDays: Number(s.defaultLabDays),
  }))

/**
 * Create / edit a stage template and its ordered steps. Saving an edit
 * replaces all steps (optimistic `version`); work already started keeps its
 * own copies. Re-seeds each time the sheet opens.
 */
export function useStageTemplateForm({
  open,
  template,
  onDone,
}: {
  open: boolean
  template: StageTemplate | null
  onDone: () => void
}) {
  const save = useSaveStageTemplate(template)
  const form = useForm({
    defaultValues: defaultsFor(template),
    validators: {
      onChange: stageTemplateSchema,
      onSubmit: stageTemplateSchema,
    },
    onSubmit: async ({ value }) => {
      if (template) {
        await save.mutateAsync({
          kind: 'update',
          body: {
            name: value.name.trim(),
            isActive: value.isActive,
            steps: toSteps(value.steps),
          },
        })
      } else {
        await save.mutateAsync({
          kind: 'create',
          body: {
            specialtyId: value.specialtyId,
            organizationId: value.owner === PLATFORM ? undefined : value.owner,
            code: value.code.trim().toUpperCase(),
            name: value.name.trim(),
            steps: toSteps(value.steps),
          },
        })
      }
      onDone()
    },
  })

  // Seed on open only, so a background refetch never resets a half-edited sheet.
  const templateRef = useRef(template)
  templateRef.current = template
  useEffect(() => {
    if (open) form.reset(defaultsFor(templateRef.current))
  }, [open, form])

  return { form, isEditing: !!template }
}
