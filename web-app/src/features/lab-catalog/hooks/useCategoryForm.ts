import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { categorySchema } from '../schemas/catalog.schema'
import type { CategoryFormValues } from '../schemas/catalog.schema'
import type { ServiceCategory } from '../types'
import { useSaveCategory } from './usePlatformCatalog'

function categoryDefaults(
  c: ServiceCategory | null,
  specialtyId: string,
): CategoryFormValues {
  return {
    specialtyId: c?.specialtyId ?? specialtyId,
    code: c?.code ?? '',
    name: c?.name ?? '',
    sortOrder: c ? String(c.sortOrder) : '',
  }
}

/** Add a category, or rename / reorder `category` (its code stays). */
export function useCategoryForm({
  open,
  category,
  defaultSpecialtyId,
  onDone,
}: {
  open: boolean
  category: ServiceCategory | null
  defaultSpecialtyId: string
  onDone: () => void
}) {
  const save = useSaveCategory()
  const form = useForm({
    defaultValues: categoryDefaults(category, defaultSpecialtyId),
    validators: { onChange: categorySchema, onSubmit: categorySchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        category,
        input: {
          specialtyId: value.specialtyId,
          code: value.code.trim().toUpperCase(),
          name: value.name.trim(),
          sortOrder: value.sortOrder ? Number(value.sortOrder) : undefined,
        },
      })
      onDone()
    },
  })
  useEffect(() => {
    if (open) form.reset(categoryDefaults(category, defaultSpecialtyId))
  }, [open, category?.id, category?.version, defaultSpecialtyId])
  return form
}
