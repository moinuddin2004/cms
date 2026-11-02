import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/forms/FormInput'
import { FormSelect } from '@/components/forms/FormSelect'
import { FormTextarea } from '@/components/forms/FormTextarea'
import { FormSection, FormSheet } from '@/components/forms/FormSheet'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { fieldError } from '@/components/forms/fieldError'
import {
  DURATION_PRESETS,
  PRESET_CATEGORY_OPTIONS,
  FREQUENCY_PRESETS,
  MEAL_RELATION_OPTIONS,
  MealRelation,
} from '../../types'
import type { PresetCategory, PrescriptionPreset } from '../../types'
import { emptyPresetMedicine, usePresetForm } from '../../hooks/usePresetForm'
import {
  MedicineAutocomplete,
  medicineFromDirectory,
} from '../MedicineAutocomplete'

/** Create or edit a prescription preset: a named set of medicines + instructions. */
export function PresetSheet({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset: PrescriptionPreset | null
}) {
  const { form, pending } = usePresetForm({
    open,
    preset,
    onDone: () => onOpenChange(false),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={preset ? 'Edit preset' : 'New prescription preset'}
      description="A ready-made set of medicines. One tap adds all of them to a prescription."
      widthClassName="sm:max-w-3xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                form="preset-form"
                disabled={!canSubmit || isSubmitting || pending}
              >
                {(isSubmitting || pending) && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {preset ? 'Save changes' : 'Create preset'}
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        id="preset-form"
        className="space-y-7"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <FormSection title="Preset">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <form.Field name="name">
              {(field) => (
                <FormInput
                  containerClassName="sm:col-span-2"
                  label="Name"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={fieldError(field)}
                  placeholder="e.g. Toothache after extraction"
                />
              )}
            </form.Field>
            <form.Field name="category">
              {(field) => (
                <FormSelect
                  label="Category"
                  required
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as PresetCategory)}
                  options={PRESET_CATEGORY_OPTIONS}
                />
              )}
            </form.Field>
          </div>
          <form.Field name="description">
            {(field) => (
              <FormTextarea
                label="Description"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-16 resize-none"
                placeholder="When to use this preset"
              />
            )}
          </form.Field>
        </FormSection>

        <form.Field name="medicines" mode="array">
          {(meds) => (
            <FormSection title={`Medicines (${meds.state.value.length})`}>
              <div className="space-y-3">
                {meds.state.value.map((_, i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-lg border border-border bg-panel/40 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-center font-mono text-xs text-text-3">
                        {i + 1}.
                      </span>
                      <form.Field name={`medicines[${i}].medicineName`}>
                        {(f) => (
                          <MedicineAutocomplete
                            className="flex-1"
                            value={f.state.value}
                            onChange={(v) => f.handleChange(v)}
                            onPick={(picked) => {
                              const seeded = medicineFromDirectory(picked)
                              form.setFieldValue(`medicines[${i}]`, {
                                ...emptyPresetMedicine(),
                                medicineDirectoryId:
                                  seeded.medicineDirectoryId ?? undefined,
                                medicineName: seeded.medicineName,
                                medicineNameUrdu:
                                  seeded.medicineNameUrdu ?? undefined,
                                type: seeded.type ?? undefined,
                                dosage: seeded.dosage,
                                frequency: seeded.frequency,
                                frequencyTiming: seeded.frequencyTiming ?? [],
                                mealRelation:
                                  seeded.mealRelation ?? MealRelation.NONE,
                                duration: seeded.duration,
                                specialInstructionsUrdu:
                                  seeded.specialInstructionsUrdu ?? undefined,
                              })
                            }}
                          />
                        )}
                      </form.Field>
                      <TooltipButton
                        type="button"
                        tooltip="Move up"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={i === 0}
                        onClick={() => void meds.moveValue(i, i - 1)}
                      >
                        <ArrowUp className="size-3.5" />
                      </TooltipButton>
                      <TooltipButton
                        type="button"
                        tooltip="Move down"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={i === meds.state.value.length - 1}
                        onClick={() => void meds.moveValue(i, i + 1)}
                      >
                        <ArrowDown className="size-3.5" />
                      </TooltipButton>
                      <TooltipButton
                        type="button"
                        tooltip="Remove medicine"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        disabled={meds.state.value.length === 1}
                        onClick={() => void meds.removeValue(i)}
                      >
                        <Trash2 className="size-3.5" />
                      </TooltipButton>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pl-8 lg:grid-cols-4">
                      <form.Field name={`medicines[${i}].dosage`}>
                        {(f) => (
                          <FormInput
                            label="Dose"
                            onBlur={f.handleBlur}
                            error={fieldError(f)}
                            value={f.state.value}
                            onChange={(e) => f.handleChange(e.target.value)}
                            placeholder="1"
                          />
                        )}
                      </form.Field>
                      <form.Field name={`medicines[${i}].frequency`}>
                        {(f) => (
                          <FormInput
                            label="How often"
                            onBlur={f.handleBlur}
                            error={fieldError(f)}
                            list="preset-frequency-presets"
                            value={f.state.value}
                            onChange={(e) => f.handleChange(e.target.value)}
                            placeholder="Twice a day"
                          />
                        )}
                      </form.Field>
                      <form.Field name={`medicines[${i}].mealRelation`}>
                        {(f) => (
                          <FormSelect
                            label="With food"
                            value={f.state.value}
                            onValueChange={(v) =>
                              f.handleChange(v as MealRelation)
                            }
                            options={MEAL_RELATION_OPTIONS.map((o) => ({
                              value: o.value,
                              label: o.label,
                            }))}
                          />
                        )}
                      </form.Field>
                      <form.Field name={`medicines[${i}].duration`}>
                        {(f) => (
                          <FormInput
                            label="For how long"
                            onBlur={f.handleBlur}
                            error={fieldError(f)}
                            list="preset-duration-presets"
                            value={f.state.value}
                            onChange={(e) => f.handleChange(e.target.value)}
                            placeholder="5 Days"
                          />
                        )}
                      </form.Field>
                    </div>
                  </div>
                ))}
                <datalist id="preset-frequency-presets">
                  {FREQUENCY_PRESETS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <datalist id="preset-duration-presets">
                  {DURATION_PRESETS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                {listError(meds) && (
                  <p className="text-xs font-medium text-danger">
                    {listError(meds)}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void meds.pushValue(emptyPresetMedicine())}
                >
                  <Plus className="size-3.5" /> Add medicine
                </Button>
              </div>
            </FormSection>
          )}
        </form.Field>

        <FormSection title="Instructions for the patient">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form.Field name="instructionsEnglish">
              {(field) => (
                <FormTextarea
                  label="English"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-24 resize-none"
                />
              )}
            </form.Field>
            <form.Field name="instructionsUrdu">
              {(field) => (
                <FormTextarea
                  label="Urdu"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  dir="rtl"
                  className="h-24 resize-none text-right"
                />
              )}
            </form.Field>
          </div>
          <form.Field name="furtherPlan">
            {(field) => (
              <FormTextarea
                label="Further plan"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-16 resize-none"
                placeholder="Follow up in 7 days…"
              />
            )}
          </form.Field>
        </FormSection>
      </form>
    </FormSheet>
  )
}

/**
 * The list-level error ("Add at least one medicine" / missing dose…). The list
 * has no input of its own, so it shows once anything in the form was touched
 * — otherwise Save could be disabled with no reason given.
 */
function listError(meds: {
  state: { meta: { errors: unknown[] } }
  form: { state: { isTouched: boolean; submissionAttempts: number } }
}) {
  return fieldError({
    state: {
      meta: {
        errors: meds.state.meta.errors,
        isTouched: meds.form.state.isTouched,
      },
    },
    form: meds.form,
  })
}
