import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/forms/FormInput'
import { FormSelect } from '@/components/forms/FormSelect'
import { FormTextarea } from '@/components/forms/FormTextarea'
import { FormSection, FormSheet } from '@/components/forms/FormSheet'
import { TooltipButton } from '@/components/shared/TooltipButton'
import {
  DURATION_PRESETS,
  PRESET_CATEGORY_OPTIONS,
  PresetCategory,
  toPresetCategory,
  FREQUENCY_PRESETS,
  MEAL_RELATION_OPTIONS,
  MealRelation,
} from '../../types'
import type { TreatmentPlanTemplate } from '../../types'
import {
  useCreateTreatmentPlanTemplate,
  useUpdateTreatmentPlanTemplate,
} from '../../hooks/useTreatmentPlanTemplates'
import {
  MedicineAutocomplete,
  medicineFromDirectory,
} from '../MedicineAutocomplete'

interface MedValues {
  medicineDirectoryId?: string
  medicineName: string
  medicineNameUrdu?: string
  type?: string
  dosage: string
  frequency: string
  frequencyTiming: string[]
  mealRelation: MealRelation
  duration: string
  specialInstructions?: string
  specialInstructionsUrdu?: string
}

const emptyMed = (): MedValues => ({
  medicineName: '',
  dosage: '1',
  frequency: '',
  frequencyTiming: [],
  mealRelation: MealRelation.NONE,
  duration: '',
})

const defaultsFor = (preset: TreatmentPlanTemplate | null) => ({
  name: preset?.name ?? '',
  category: preset ? toPresetCategory(preset.category) : PresetCategory.GENERAL,
  description: preset?.description ?? '',
  furtherPlan: preset?.furtherPlan ?? '',
  instructionsEnglish: preset?.instructionsEnglish ?? '',
  instructionsUrdu: preset?.instructionsUrdu ?? '',
  medicines: preset?.medicines.length
    ? [...preset.medicines]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(
          (m): MedValues => ({
            medicineDirectoryId: m.medicineDirectoryId ?? undefined,
            medicineName: m.medicineName,
            medicineNameUrdu: m.medicineNameUrdu ?? undefined,
            type: m.type ?? undefined,
            dosage: m.dosage,
            frequency: m.frequency,
            frequencyTiming: m.frequencyTiming,
            mealRelation: m.mealRelation,
            duration: m.duration,
            specialInstructions: m.specialInstructions ?? undefined,
            specialInstructionsUrdu: m.specialInstructionsUrdu ?? undefined,
          }),
        )
    : [emptyMed()],
})

/** Create or edit a prescription preset: a named set of medicines + instructions. */
export function PresetSheet({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset: TreatmentPlanTemplate | null
}) {
  const create = useCreateTreatmentPlanTemplate()
  const update = useUpdateTreatmentPlanTemplate()
  const pending = create.isPending || update.isPending

  const form = useForm({
    defaultValues: defaultsFor(preset),
    onSubmit: async ({ value }) => {
      const blank = (v: string) => v.trim() || null
      const payload = {
        name: value.name.trim(),
        category: value.category,
        description: blank(value.description),
        furtherPlan: blank(value.furtherPlan),
        instructionsEnglish: blank(value.instructionsEnglish),
        instructionsUrdu: blank(value.instructionsUrdu),
        medicines: value.medicines
          .filter((m) => m.medicineName.trim())
          .map((m, sortOrder) => ({ ...m, sortOrder })),
      }
      if (preset)
        await update.mutateAsync({ id: preset.id, data: payload as never })
      else await create.mutateAsync(payload as never)
      onOpenChange(false)
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(preset))
  }, [open, preset])

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
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) =>
                  value.trim() ? undefined : 'Name is required',
              }}
            >
              {(field) => (
                <FormInput
                  containerClassName="sm:col-span-2"
                  label="Name"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  error={field.state.meta.errors[0]}
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

        <form.Field
          name="medicines"
          mode="array"
          validators={{
            onChange: ({ value }) => {
              const named = value.filter((m) => m.medicineName.trim())
              if (named.length === 0) return 'Add at least one medicine'
              return named.every(
                (m) =>
                  m.dosage.trim() && m.frequency.trim() && m.duration.trim(),
              )
                ? undefined
                : 'Fill in dose, how often and for how long for every medicine'
            },
          }}
        >
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
                                ...emptyMed(),
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
                {meds.state.meta.errors[0] && (
                  <p className="text-xs font-medium text-danger">
                    {meds.state.meta.errors[0]}
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void meds.pushValue(emptyMed())}
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
