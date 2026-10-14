import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/forms/FormInput'
import { FormSelect } from '@/components/forms/FormSelect'
import { FormSection, FormSheet } from '@/components/forms/FormSheet'
import {
  DURATION_PRESETS,
  FREQUENCY_PRESETS,
  MEAL_RELATION_OPTIONS,
  MEDICINE_TYPE_OPTIONS,
  MealRelation,
  MedicineType,
} from '../../types'
import type { MedicineDirectoryItem } from '../../types'
import {
  useCreateMedicine,
  useUpdateMedicine,
} from '../../hooks/useMedicineDirectory'

const defaultsFor = (item: MedicineDirectoryItem | null) => ({
  name: item?.name ?? '',
  genericName: item?.genericName ?? '',
  nameUrdu: item?.nameUrdu ?? '',
  type: item?.type ?? MedicineType.TABLET,
  strength: item?.strength ?? '',
  defaultDosage: item?.defaultDosage ?? '',
  defaultFrequency: item?.defaultFrequency ?? '',
  defaultDuration: item?.defaultDuration ?? '',
  defaultMealRelation: item?.defaultMealRelation ?? MealRelation.NONE,
})

/** Add or edit one medicine in the catalogue. */
export function MedicineSheet({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: MedicineDirectoryItem | null
}) {
  const create = useCreateMedicine()
  const update = useUpdateMedicine()
  const pending = create.isPending || update.isPending

  const form = useForm({
    defaultValues: defaultsFor(item),
    onSubmit: async ({ value }) => {
      const blank = (v: string) => v.trim() || null
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
      onOpenChange(false)
    },
  })

  // The sheet stays mounted; start each opening from the right medicine.
  useEffect(() => {
    if (open) form.reset(defaultsFor(item))
  }, [open, item])

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={item ? 'Edit medicine' : 'Add medicine'}
      description="Defaults fill in automatically when the doctor picks this medicine on a prescription."
      widthClassName="sm:max-w-lg"
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
                form="medicine-form"
                disabled={!canSubmit || isSubmitting || pending}
              >
                {(isSubmitting || pending) && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {item ? 'Save changes' : 'Add medicine'}
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        id="medicine-form"
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <FormSection title="Medicine">
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) =>
                value.trim() ? undefined : 'Name is required',
            }}
          >
            {(field) => (
              <FormInput
                label="Name"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors[0]}
                placeholder="Augmentin 625mg Tab"
              />
            )}
          </form.Field>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="genericName">
              {(field) => (
                <FormInput
                  label="Generic name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Amoxicillin + Clavulanate"
                />
              )}
            </form.Field>
            <form.Field name="nameUrdu">
              {(field) => (
                <FormInput
                  label="Urdu name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  dir="rtl"
                  className="text-right"
                />
              )}
            </form.Field>
            <form.Field name="type">
              {(field) => (
                <FormSelect
                  label="Type"
                  required
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as MedicineType)}
                  options={MEDICINE_TYPE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              )}
            </form.Field>
            <form.Field name="strength">
              {(field) => (
                <FormInput
                  label="Strength"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="500mg"
                />
              )}
            </form.Field>
          </div>
        </FormSection>

        <FormSection title="Defaults on a prescription">
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="defaultDosage">
              {(field) => (
                <FormInput
                  label="Dose"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="1"
                />
              )}
            </form.Field>
            <form.Field name="defaultMealRelation">
              {(field) => (
                <FormSelect
                  label="With food"
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as MealRelation)}
                  options={MEAL_RELATION_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              )}
            </form.Field>
            <form.Field name="defaultFrequency">
              {(field) => (
                <FormInput
                  label="How often"
                  list="med-frequency-presets"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Twice a day"
                />
              )}
            </form.Field>
            <form.Field name="defaultDuration">
              {(field) => (
                <FormInput
                  label="For how long"
                  list="med-duration-presets"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="5 Days"
                />
              )}
            </form.Field>
          </div>
          <datalist id="med-frequency-presets">
            {FREQUENCY_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <datalist id="med-duration-presets">
            {DURATION_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </FormSection>
      </form>
    </FormSheet>
  )
}
