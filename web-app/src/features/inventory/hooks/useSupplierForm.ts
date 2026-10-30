import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { supplierSchema } from '../schemas/inventory.schema'
import type { SupplierFormValues } from '../schemas/inventory.schema'
import type { Supplier, SupplierFormData } from '../types'
import { useCreateSupplier, useUpdateSupplier } from './useSuppliers'

function defaultsFor(supplier: Supplier | null): SupplierFormValues {
  return {
    name: supplier?.name ?? '',
    contactPerson: supplier?.contactPerson ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    address: supplier?.address ?? '',
    city: supplier?.city ?? '',
    website: supplier?.website ?? '',
    notes: supplier?.notes ?? '',
  }
}

/** Create / edit a supplier. Re-seeds each time the dialog opens. */
export function useSupplierForm({
  open,
  supplier,
  onDone,
}: {
  open: boolean
  supplier: Supplier | null
  onDone: () => void
}) {
  const createMutation = useCreateSupplier()
  const updateMutation = useUpdateSupplier()

  const form = useForm({
    defaultValues: defaultsFor(supplier),
    validators: { onChange: supplierSchema, onSubmit: supplierSchema },
    onSubmit: async ({ value }) => {
      const payload: SupplierFormData = { ...value, name: value.name.trim() }
      try {
        if (supplier) {
          await updateMutation.mutateAsync({ id: supplier.id, payload })
        } else {
          await createMutation.mutateAsync(payload)
        }
        onDone()
      } catch {
        // error toast comes from the mutation hook
      }
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(supplier))
  }, [open, supplier, form])

  return { form, isEdit: !!supplier }
}
