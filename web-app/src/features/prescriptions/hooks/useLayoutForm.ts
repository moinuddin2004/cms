import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { layoutSchema } from '../schemas/library.schema'
import type { LayoutFormValues } from '../schemas/library.schema'
import { PageSize } from '../types'
import type { PrescriptionTemplate } from '../types'
import {
  useCreatePrescriptionTemplate,
  useUpdatePrescriptionTemplate,
} from './usePrescriptionTemplates'

const DEFAULT_COLOR = '#0d9488'

function defaultsFor(layout: PrescriptionTemplate | null): LayoutFormValues {
  return {
    name: layout?.name ?? '',
    pageSize: layout?.pageSize ?? PageSize.A4,
    isDefault: layout?.isDefault ?? false,
    primaryColor:
      (layout?.styling.primaryColor as string | undefined) ?? DEFAULT_COLOR,
    showVitals: layout?.styling.showVitals !== false,
    showMedicineUrdu: layout?.styling.showMedicineUrdu !== false,
    showPatientGender: layout?.styling.showPatientGender !== false,
    showDate: layout?.styling.showDate !== false,
    clinicName: (layout?.header.clinicName as string | undefined) ?? '',
    clinicNameUrdu: (layout?.header.clinicNameUrdu as string | undefined) ?? '',
    doctorQualification:
      (layout?.header.doctorQualification as string | undefined) ?? '',
    registrationNumber:
      (layout?.header.registrationNumber as string | undefined) ?? '',
    doctorPhone: (layout?.header.doctorPhone as string | undefined) ?? '',
    address: (layout?.footer.address as string | undefined) ?? '',
    timings: (layout?.footer.timings as string | undefined) ?? '',
    phone: (layout?.footer.phone as string | undefined) ?? '',
    disclaimerText: (layout?.footer.disclaimerText as string | undefined) ?? '',
  }
}

/** The settings in the form, laid out the way the printed template stores them. */
export function toLayoutParts(
  v: LayoutFormValues,
  layout: PrescriptionTemplate | null,
) {
  return {
    header: {
      ...layout?.header,
      clinicName: v.clinicName,
      clinicNameUrdu: v.clinicNameUrdu,
      doctorQualification: v.doctorQualification,
      registrationNumber: v.registrationNumber,
      doctorPhone: v.doctorPhone,
    },
    footer: {
      ...layout?.footer,
      address: v.address,
      timings: v.timings,
      phone: v.phone,
      disclaimerText: v.disclaimerText,
    },
    styling: {
      ...layout?.styling,
      primaryColor: v.primaryColor,
      showVitals: v.showVitals,
      showMedicineUrdu: v.showMedicineUrdu,
      showPatientGender: v.showPatientGender,
      showDate: v.showDate,
    },
  }
}

/** Create or edit a print layout. Re-seeds each time the sheet opens. */
export function useLayoutForm({
  open,
  layout,
  onDone,
}: {
  open: boolean
  layout: PrescriptionTemplate | null
  onDone: () => void
}) {
  const create = useCreatePrescriptionTemplate()
  const update = useUpdatePrescriptionTemplate()

  const form = useForm({
    defaultValues: defaultsFor(layout),
    validators: { onChange: layoutSchema, onSubmit: layoutSchema },
    onSubmit: async ({ value }) => {
      const payload = {
        name: value.name.trim(),
        pageSize: value.pageSize,
        isDefault: value.isDefault,
        ...toLayoutParts(value, layout),
      }
      if (layout) await update.mutateAsync({ id: layout.id, data: payload })
      else await create.mutateAsync(payload)
      onDone()
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(layout))
  }, [open, layout, form])

  return { form, pending: create.isPending || update.isPending }
}
