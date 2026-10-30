import { useEffect, useMemo } from 'react'
import { useForm } from '@tanstack/react-form'
import { createLocationSchema } from '../schemas/location.schema'
import type { LocationFormValues } from '../schemas/location.schema'
import type { Location } from '../LocationManagementView'

export interface LocationCreatePayload {
  organizationId?: string
  name: string
  code: string
  address?: string
  city?: string
  country?: string
  phone?: string
  email?: string
}

export interface LocationUpdatePayload {
  name: string
  address: string | null
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
}

function defaultsFor(loc: Location | null): LocationFormValues {
  return {
    organizationId: loc?.organizationId ?? '',
    name: loc?.name ?? '',
    code: loc?.code ?? '',
    address: loc?.address ?? '',
    city: loc?.city ?? '',
    country: loc?.country ?? '',
    phone: loc?.phone ?? '',
    email: loc?.email ?? '',
  }
}

/**
 * Create / edit a location. Re-seeds each time the dialog opens. Blank
 * optional fields are omitted on create and cleared (null) on edit; code and
 * organization are fixed after creation, so they're only sent on create.
 */
export function useLocationForm({
  open,
  location,
  requireOrganization,
  onCreate,
  onUpdate,
}: {
  open: boolean
  location: Location | null
  /** Super admin creating — must pick the organization. */
  requireOrganization: boolean
  onCreate: (data: LocationCreatePayload) => Promise<unknown>
  onUpdate: (id: string, data: LocationUpdatePayload) => Promise<unknown>
}) {
  const schema = useMemo(
    () => createLocationSchema({ requireOrganization }),
    [requireOrganization],
  )

  const form = useForm({
    defaultValues: defaultsFor(location),
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      const v = {
        name: value.name.trim(),
        code: value.code.trim(),
        address: value.address.trim(),
        city: value.city.trim(),
        country: value.country.trim(),
        phone: value.phone.trim(),
        email: value.email.trim(),
      }
      try {
        if (location) {
          await onUpdate(location.id, {
            name: v.name,
            address: v.address || null,
            city: v.city || null,
            country: v.country || null,
            phone: v.phone || null,
            email: v.email || null,
          })
        } else {
          await onCreate({
            organizationId: value.organizationId || undefined,
            name: v.name,
            code: v.code,
            address: v.address || undefined,
            city: v.city || undefined,
            country: v.country || undefined,
            phone: v.phone || undefined,
            email: v.email || undefined,
          })
        }
      } catch {
        // The mutation's onError already shows the server message.
      }
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(location))
  }, [open, location, form])

  return { form, isEditing: !!location }
}
