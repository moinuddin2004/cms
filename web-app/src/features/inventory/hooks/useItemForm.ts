import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { itemSchema } from '../schemas/inventory.schema'
import type { ItemFormValues } from '../schemas/inventory.schema'
import type { InventoryItem } from '../types'
import { useCreateItem, useUpdateItem } from './useInventory'

function defaultsFor(item: InventoryItem | null | undefined): ItemFormValues {
  if (!item) {
    return {
      name: '',
      sku: '',
      categoryId: '',
      initialStock: '0',
      unit: 'pieces',
      unitPrice: '0',
      sellingPrice: '',
      reorderLevel: '10',
      expiryDate: '',
      description: '',
      isBillable: false,
    }
  }
  return {
    name: item.name,
    sku: item.sku ?? '',
    categoryId: item.categoryId ?? '',
    initialStock: '0',
    unit: item.unit,
    unitPrice: String(Number(item.unitPrice)),
    sellingPrice:
      item.sellingPrice != null ? String(Number(item.sellingPrice)) : '',
    reorderLevel: String(Number(item.reorderLevel)),
    expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : '',
    description: item.description ?? '',
    isBillable: item.isBillable,
  }
}

/** Create / edit an inventory item. Re-seeds each time the dialog opens. */
export function useItemForm({
  open,
  item,
  onDone,
}: {
  open: boolean
  item?: InventoryItem | null
  onDone: () => void
}) {
  const createMutation = useCreateItem()
  const updateMutation = useUpdateItem()

  const form = useForm({
    defaultValues: defaultsFor(item),
    validators: { onChange: itemSchema, onSubmit: itemSchema },
    onSubmit: async ({ value }) => {
      const common = {
        name: value.name.trim(),
        sku: value.sku.trim() || undefined,
        categoryId: value.categoryId || undefined,
        unit: value.unit,
        unitPrice: Number(value.unitPrice) || 0,
        sellingPrice:
          value.sellingPrice.trim() === ''
            ? undefined
            : Number(value.sellingPrice),
        reorderLevel: Number(value.reorderLevel) || 0,
        expiryDate: value.expiryDate || undefined,
        description: value.description.trim() || undefined,
        isBillable: value.isBillable,
      }
      try {
        if (item) {
          await updateMutation.mutateAsync({ id: item.id, payload: common })
        } else {
          await createMutation.mutateAsync({
            ...common,
            initialStock: Number(value.initialStock) || 0,
          })
        }
        onDone()
      } catch {
        // error toast comes from the mutation hook
      }
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(item))
  }, [open, item, form])

  return { form, isEdit: !!item }
}
