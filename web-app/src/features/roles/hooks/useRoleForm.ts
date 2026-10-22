import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { cloneRoleSchema, createRoleSchema } from '../schemas/roles.schema'
import type { CreateRoleValues } from '../schemas/roles.schema'
import type { RoleDetail, RoleSummary } from '../types/roles.types'
import { highRiskAdded } from '../lib/bundles'
import { useCloneRole, useCreateRole } from './useRoles'

const blankCreate: CreateRoleValues = { name: '', description: '' }

/** New custom role: name + description; permissions are set on its page. */
export function useCreateRoleForm({
  open,
  onDone,
}: {
  open: boolean
  onDone: (role: RoleDetail) => void
}) {
  const create = useCreateRole()
  const form = useForm({
    defaultValues: blankCreate,
    validators: { onChange: createRoleSchema, onSubmit: createRoleSchema },
    onSubmit: async ({ value }) => {
      const role = await create.mutateAsync({
        name: value.name.trim(),
        description: value.description.trim() || null,
        permissions: {},
      })
      onDone(role)
    },
  })

  useEffect(() => {
    if (open) form.reset(blankCreate)
  }, [open, form])

  return { form }
}

/** Clone any role; asks for a reason when the source has high-risk grants. */
export function useCloneRoleForm({
  open,
  source,
  onDone,
}: {
  open: boolean
  source: RoleSummary | null
  onDone: (role: RoleDetail) => void
}) {
  const clone = useCloneRole()
  const riskyPermissions = source ? highRiskAdded({}, source.permissions) : []
  const needsReason = riskyPermissions.length > 0
  const schema = cloneRoleSchema(needsReason)
  const defaults = { name: source ? `${source.name} (copy)` : '', reason: '' }

  const form = useForm({
    defaultValues: defaults,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      if (!source) return
      const role = await clone.mutateAsync({
        id: source.id,
        name: value.name.trim(),
        reason: value.reason.trim() || undefined,
      })
      onDone(role)
    },
  })

  useEffect(() => {
    if (open)
      form.reset({ name: source ? `${source.name} (copy)` : '', reason: '' })
  }, [open, source, form])

  return { form, needsReason, riskyPermissions }
}
