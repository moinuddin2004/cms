import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import {
  SUBSCRIPTION_PLANS,
  organizationSchema,
} from '../schemas/organization.schema'
import type {
  OrganizationFormValues,
  SubscriptionPlan,
} from '../schemas/organization.schema'
import type { Organization } from '../OrganizationManagementView'

export interface OrganizationPayload {
  name: string
  subscriptionPlan: SubscriptionPlan
}

const isPlan = (v: unknown): v is SubscriptionPlan =>
  (SUBSCRIPTION_PLANS as readonly unknown[]).includes(v)

function defaultsFor(org: Organization | null): OrganizationFormValues {
  return {
    name: org?.name ?? '',
    subscriptionPlan: isPlan(org?.subscriptionPlan)
      ? org.subscriptionPlan
      : 'free',
  }
}

/** Create / edit an organization (super admin). Re-seeds on every open. */
export function useOrganizationForm({
  open,
  organization,
  onCreate,
  onUpdate,
}: {
  open: boolean
  organization: Organization | null
  onCreate: (data: OrganizationPayload) => Promise<unknown>
  onUpdate: (id: string, data: OrganizationPayload) => Promise<unknown>
}) {
  const form = useForm({
    defaultValues: defaultsFor(organization),
    validators: { onChange: organizationSchema, onSubmit: organizationSchema },
    onSubmit: async ({ value }) => {
      const data: OrganizationPayload = {
        name: value.name.trim(),
        subscriptionPlan: value.subscriptionPlan,
      }
      try {
        if (organization) await onUpdate(organization.id, data)
        else await onCreate(data)
      } catch {
        // The mutation's onError already shows the server message.
      }
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(organization))
  }, [open, organization, form])

  return { form, isEditing: !!organization }
}
