import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { medicineSchema } from '../schemas/library.schema'
import type { MedicineFormValues } from '../schemas/library.schema'
import { MealRelation, MedicineType } from '../types'
import type { MedicineDirectoryItem } from '../types'
import { useCreateMedicine, useUpdateMedicine } from './useMedicineDirectory'

const blank = (v: string) => v.trim() || null

function defaultsFor(item: MedicineDirectoryItem | null): MedicineFormValues {
  return {
    name: item?.name ?? '',
    genericName: item?.genericName ?? '',
    nameUrdu: item?.nameUrdu ?? '',
    type: item?.type ?? MedicineType.TABLET,
    strength: item?.strength ?? '',
    defaultDosage: item?.defaultDosage ?? '',
    defaultFrequency: item?.defaultFrequency ?? '',
    defaultDuration: item?.defaultDuration ?? '',
    defaultMealRelation: item?.defaultMealRelation ?? MealRelation.NONE,
  }
}

/** Add or edit one catalogue medicine. Re-seeds each time the sheet opens. */
export function useMedicineForm({
  open,
  item,
  onDone,
}: {
  open: boolean
  item: MedicineDirectoryItem | null
  onDone: () => void
}) {
  const create = useCreateMedicine()
  const update = useUpdateMedicine()

  const form = useForm({
    defaultValues: defaultsFor(item),
    validators: { onChange: medicineSchema, onSubmit: medicineSchema },
    onSubmit: async ({ value }) => {
      const payload = {
        name: value.name.trim(),
        genericName: blank(value.genericName),
        nameUrdu: blank(value.nameUrdu),
        type: value.type,
        strength: blank(value.strength),
        defaultDosage: blank(value.defaultDosage),
        defaultFrequency: blank(value.defaultFrequency),
        defaultDuration: blank(value.defaultDuration),
        defaultMealRelation: value.defaultMealRelation,
      }
      if (item) await update.mutateAsync({ id: item.id, data: payload })
      else await create.mutateAsync(payload)
      onDone()
    },
  })

  // The sheet stays mounted; start each opening from the right medicine.
  useEffect(() => {
    if (open) form.reset(defaultsFor(item))
  }, [open, item, form])

  return { form, pending: create.isPending || update.isPending }
}
