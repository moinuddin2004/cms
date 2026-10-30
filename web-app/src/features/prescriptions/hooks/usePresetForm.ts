import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { presetSchema } from '../schemas/library.schema'
import type {
  PresetFormValues,
  PresetMedicineValues,
} from '../schemas/library.schema'
import { MealRelation, PresetCategory, toPresetCategory } from '../types'
import type { TreatmentPlanTemplate } from '../types'
import {
  useCreateTreatmentPlanTemplate,
  useUpdateTreatmentPlanTemplate,
} from './useTreatmentPlanTemplates'

export const emptyPresetMedicine = (): PresetMedicineValues => ({
  medicineName: '',
  dosage: '1',
  frequency: '',
  frequencyTiming: [],
  mealRelation: MealRelation.NONE,
  duration: '',
})

function defaultsFor(preset: TreatmentPlanTemplate | null): PresetFormValues {
  return {
    name: preset?.name ?? '',
    category: preset
      ? toPresetCategory(preset.category)
      : PresetCategory.GENERAL,
    description: preset?.description ?? '',
    furtherPlan: preset?.furtherPlan ?? '',
    instructionsEnglish: preset?.instructionsEnglish ?? '',
    instructionsUrdu: preset?.instructionsUrdu ?? '',
    medicines: preset?.medicines.length
      ? [...preset.medicines]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((m): PresetMedicineValues => ({
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
          }))
      : [emptyPresetMedicine()],
  }
}

/** Create or edit a prescription preset. Re-seeds each time the sheet opens. */
export function usePresetForm({
  open,
  preset,
  onDone,
}: {
  open: boolean
  preset: TreatmentPlanTemplate | null
  onDone: () => void
}) {
  const create = useCreateTreatmentPlanTemplate()
  const update = useUpdateTreatmentPlanTemplate()

  const form = useForm({
    defaultValues: defaultsFor(preset),
    validators: { onChange: presetSchema, onSubmit: presetSchema },
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
      onDone()
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(preset))
  }, [open, preset, form])

  return { form, pending: create.isPending || update.isPending }
}
