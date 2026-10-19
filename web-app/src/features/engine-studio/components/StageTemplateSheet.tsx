import { ArrowDown, ArrowUp, Loader2, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  FieldWrapper,
  FormSection,
  FormSelect,
  FormSheet,
} from '@/components/shared'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { fieldError } from '@/features/queue'
import { useAuthStore } from '@/store/useAuthStore'
import { useSpecialties } from '../hooks/useFormSchemas'
import { blankStep, useStageTemplateForm } from '../hooks/useStageTemplateForm'
import { PLATFORM } from '../schemas/studio.schema'
import type { StageTemplate } from '../types'

/**
 * Create or edit a stage template: the ordered try-in steps (e.g. metal
 * try-in → bisque try-in → final), each moved up / down, added or removed.
 */
export function StageTemplateSheet({
  open,
  onOpenChange,
  template,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: StageTemplate | null
}) {
  const { form, isEditing } = useStageTemplateForm({
    open,
    template,
    onDone: () => onOpenChange(false),
  })
  const specialties = useSpecialties()
  const organizations = useAuthStore((s) => s.accessibleOrganizations)

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={isEditing ? `Edit ${template?.code}` : 'New stage template'}
      description="Orders copy the steps when work starts, so changes only affect work that starts later."
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
                {isEditing ? 'Save changes' : 'Create template'}
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
        <FormSection title="Template">
          <div className="space-y-4">
            {!isEditing && (
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="specialtyId">
                  {(f) => (
                    <FormSelect
                      label="Specialty"
                      required
                      placeholder="Choose a specialty"
                      value={f.state.value}
                      onValueChange={f.handleChange}
                      options={(specialties.data ?? []).map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
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
                        { value: PLATFORM, label: 'Platform default' },
                        ...organizations.map((o) => ({
                          value: o.id,
                          label: o.name,
                        })),
                      ]}
                    />
                  )}
                </form.Field>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {!isEditing && (
                <form.Field name="code">
                  {(f) => (
                    <FieldWrapper
                      label="Code"
                      htmlFor="stage-code"
                      required
                      hint="Saved upper-case, e.g. PFM_3_STAGE."
                      error={fieldError(f)}
                    >
                      <Input
                        id="stage-code"
                        className="font-mono uppercase"
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        onBlur={f.handleBlur}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
              )}
              <form.Field name="name">
                {(f) => (
                  <FieldWrapper
                    label="Name"
                    htmlFor="stage-name"
                    required
                    error={fieldError(f)}
                  >
                    <Input
                      id="stage-name"
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      onBlur={f.handleBlur}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            </div>
            {isEditing && (
              <form.Field name="isActive">
                {(f) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={f.state.value}
                      onCheckedChange={f.handleChange}
                      aria-label="Active"
                    />
                    {f.state.value
                      ? 'Active — offered for new items'
                      : 'Inactive — not offered for new items'}
                  </label>
                )}
              </form.Field>
            )}
          </div>
        </FormSection>

        <FormSection title="Steps">
          <form.Field name="steps" mode="array">
            {(steps) => (
              <div className="space-y-3">
                {steps.state.value.map((_, i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-lg border border-border p-3"
                    aria-label={`Step ${i + 1}`}
                    role="group"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">Step {i + 1}</span>
                      <div className="ml-auto flex">
                        <TooltipButton
                          tooltip={`Move step ${i + 1} up`}
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={i === 0}
                          onClick={() => steps.swapValues(i, i - 1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </TooltipButton>
                        <TooltipButton
                          tooltip={`Move step ${i + 1} down`}
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={i === steps.state.value.length - 1}
                          onClick={() => steps.swapValues(i, i + 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </TooltipButton>
                        <TooltipButton
                          tooltip={`Remove step ${i + 1}`}
                          variant="ghost"
                          size="icon"
                          className="size-7 text-danger"
                          disabled={steps.state.value.length === 1}
                          onClick={() => steps.removeValue(i)}
                        >
                          <X className="size-3.5" />
                        </TooltipButton>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_6rem]">
                      <form.Field name={`steps[${i}].code`}>
                        {(f) => (
                          <FieldWrapper
                            label="Code"
                            htmlFor={`step-${i}-code`}
                            required
                            error={fieldError(f)}
                          >
                            <Input
                              id={`step-${i}-code`}
                              className="font-mono text-xs"
                              placeholder="metal_tryin"
                              value={f.state.value}
                              onChange={(e) =>
                                f.handleChange(e.target.value.toLowerCase())
                              }
                              onBlur={f.handleBlur}
                            />
                          </FieldWrapper>
                        )}
                      </form.Field>
                      <form.Field name={`steps[${i}].name`}>
                        {(f) => (
                          <FieldWrapper
                            label="Name"
                            htmlFor={`step-${i}-name`}
                            required
                            error={fieldError(f)}
                          >
                            <Input
                              id={`step-${i}-name`}
                              placeholder="Metal try-in"
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value)}
                              onBlur={f.handleBlur}
                            />
                          </FieldWrapper>
                        )}
                      </form.Field>
                      <form.Field name={`steps[${i}].defaultLabDays`}>
                        {(f) => (
                          <FieldWrapper
                            label="Lab days"
                            htmlFor={`step-${i}-days`}
                            required
                            error={fieldError(f)}
                          >
                            <Input
                              id={`step-${i}-days`}
                              inputMode="numeric"
                              value={f.state.value}
                              onChange={(e) => f.handleChange(e.target.value)}
                              onBlur={f.handleBlur}
                            />
                          </FieldWrapper>
                        )}
                      </form.Field>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <form.Field name={`steps[${i}].requiresPatientVisit`}>
                        {(f) => (
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={f.state.value}
                              onCheckedChange={(c) =>
                                f.handleChange(c === true)
                              }
                            />
                            Patient visit (try-in)
                          </label>
                        )}
                      </form.Field>
                      <form.Field name={`steps[${i}].requiresDoctorApproval`}>
                        {(f) => (
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={f.state.value}
                              onCheckedChange={(c) =>
                                f.handleChange(c === true)
                              }
                            />
                            Doctor approval
                          </label>
                        )}
                      </form.Field>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={steps.state.value.length >= 20}
                    onClick={() => steps.pushValue(blankStep())}
                  >
                    <Plus className="size-4" /> Add step
                  </Button>
                  {fieldError(steps) && (
                    <p className="text-xs font-medium text-danger">
                      {fieldError(steps)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </form.Field>
        </FormSection>
      </form>
    </FormSheet>
  )
}
