import { useForm } from '@tanstack/react-form'
import { toInputValue, toNumber } from '@/lib/zod-numbers'
import {
  setupClinicSchema,
  setupLocationSchema,
} from '../schemas/account.schema'
import type {
  SetupClinicInput,
  SetupLocationFormValues,
} from '../schemas/account.schema'
import type { ClinicSetup } from '../types'
import { useSaveSetupClinic, useSaveSetupLocation } from './useAccount'
import { useAuthStore } from '@/store/useAuthStore'

/**
 * Mirror the server rule in the session: branches still on the old clinic
 * timezone (or UTC) move to the new one, so times on screen switch at once.
 */
function followClinicTimezone(previous: string | undefined, next: string) {
  if (!previous || previous === next) return
  const { accessibleOrganizations, activeOrganizationId, setLocationTimezone } =
    useAuthStore.getState()
  const org = accessibleOrganizations.find((o) => o.id === activeOrganizationId)
  for (const loc of org?.locations ?? []) {
    if (!loc.timezone || loc.timezone === previous || loc.timezone === 'UTC') {
      setLocationTimezone(loc.id, next)
    }
  }
}

export function clinicDefaults(
  setup: ClinicSetup | undefined,
): SetupClinicInput {
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
): SetupLocationFormValues {
  const l = setup?.location
  return {
    name: l?.name ?? setup?.clinic.name ?? '',
    address: l?.address ?? '',
    city: l?.city ?? '',
    phone: l?.phone ?? setup?.clinic.phone ?? '',
    email: l?.email ?? '',
    taxRate: toInputValue(l?.taxRate ?? 0),
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
    onSubmit: async ({ value, formApi }) => {
      await save.mutateAsync({
        ...value,
        currency: value.currency.toUpperCase(),
      })
      followClinicTimezone(setup?.clinic.timezone, value.timezone)
      // Saved values become the new baseline (settings: hides the save bar).
      formApi.reset(value)
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
      await save.mutateAsync({ ...value, taxRate: toNumber(value.taxRate) })
      onSaved()
    },
  })
  return { form, save }
}
