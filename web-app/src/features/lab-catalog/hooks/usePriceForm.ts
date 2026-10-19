import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { catalogToday, paisaToRupeesText, rupeesToPaisa } from '../lib/money'
import { priceSchema } from '../schemas/catalog.schema'
import type { PriceFormValues } from '../schemas/catalog.schema'
import type { PriceWindow } from '../types'
import { useSavePrice } from './usePlatformCatalog'

const blank = (v: string) => v.trim() || null
const paisa = (v: string) => rupeesToPaisa(v) ?? 0

function priceDefaults(
  p: PriceWindow | null,
  organizationId: string,
): PriceFormValues {
  return {
    organizationId: p?.organization?.id ?? organizationId,
    unitPrice: p ? paisaToRupeesText(p.unitPricePaisa) : '',
    rushSurcharge: p ? paisaToRupeesText(p.rushSurchargePaisa) : '',
    effectiveFrom: p?.effectiveFrom ?? catalogToday(),
    effectiveTo: p?.effectiveTo ?? '',
    notes: p?.notes ?? '',
  }
}

/**
 * Add a price window, or edit one. A price already in use only takes a
 * new end date (the server refuses anything else), so the sheet locks the
 * other fields for it.
 */
export function usePriceForm({
  open,
  labId,
  serviceId,
  price,
  organizationId,
  onDone,
}: {
  open: boolean
  labId: string
  serviceId: string
  price: PriceWindow | null
  /** Pre-selected clinic for a new negotiated price ('' = list price). */
  organizationId: string
  onDone: () => void
}) {
  const save = useSavePrice(labId, serviceId, price)
  const form = useForm({
    defaultValues: priceDefaults(price, organizationId),
    validators: { onChange: priceSchema, onSubmit: priceSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        organizationId: value.organizationId || null,
        unitPricePaisa: paisa(value.unitPrice),
        rushSurchargePaisa: paisa(value.rushSurcharge),
        effectiveFrom: value.effectiveFrom,
        effectiveTo: value.effectiveTo || null,
        notes: blank(value.notes),
      })
      onDone()
    },
  })
  useEffect(() => {
    if (open) form.reset(priceDefaults(price, organizationId))
  }, [open, price, organizationId, form])
  const started = !!price && price.effectiveFrom <= catalogToday()
  return { form, isEditing: !!price, started }
}
