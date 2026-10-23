import { useForm } from '@tanstack/react-form'
import {
  setupClinicSchema,
  setupLocationSchema,
} from '../schemas/account.schema'
import type {
  SetupClinicInput,
  SetupLocationInput,
} from '../schemas/account.schema'
import type { ClinicSetup } from '../types'
import { useSaveSetupClinic, useSaveSetupLocation } from './useAccount'

export function clinicDefaults(setup: ClinicSetup | undefined): SetupClinicInput {
  const c = setup?.clinic
  return {
    name: c?.name ?? '',
    phone: c?.phone ?? '',
    email: c?.email ?? '',
    website: c?.website ?? '',
    specialtyTags: c?.specialtyTags?.length ? c.specialtyTags : ['general'],
    timezone: c?.timezone ?? 'Asia/Karachi',
    currency: c?.currency ?? 'PKR',
  }
}

export function locationDefaults(
  setup: ClinicSetup | undefined,
): SetupLocationInput {
  const l = setup?.location
  return {
    name: l?.name ?? setup?.clinic.name ?? '',
    address: l?.address ?? '',
    city: l?.city ?? '',
    phone: l?.phone ?? setup?.clinic.phone ?? '',
    email: l?.email ?? '',
    taxRate: l?.taxRate ?? 0,
  }
}

/** Setup wizard step 1: the clinic itself. */
export function useSetupClinicForm(
  setup: ClinicSetup | undefined,
  onSaved: () => void,
) {
  const save = useSaveSetupClinic()
  const form = useForm({
    defaultValues: clinicDefaults(setup),
    validators: { onChange: setupClinicSchema, onSubmit: setupClinicSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        ...value,
        currency: value.currency.toUpperCase(),
      })
      onSaved()
    },
  })
  return { form, save }
}

/** Setup wizard step 2: the main location and its tax rate. */
export function useSetupLocationForm(
  setup: ClinicSetup | undefined,
  onSaved: () => void,
) {
  const save = useSaveSetupLocation()
  const form = useForm({
    defaultValues: locationDefaults(setup),
    validators: {
      onChange: setupLocationSchema,
      onSubmit: setupLocationSchema,
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync(value)
      onSaved()
    },
  })
  return { form, save }
}
