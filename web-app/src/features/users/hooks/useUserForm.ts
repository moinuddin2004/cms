import { useEffect, useMemo } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { useAuthStore } from '@/store/useAuthStore'
import { useCreateUser, useUpdateUser } from '../api'
import { makeUserSchema } from '../schemas/user.schema'
import type { UserFormValues } from '../schemas/user.schema'
import type { User, UserRoleType } from '../types'

function defaultsFor(
  user: User | null,
  activeTab: UserRoleType,
): UserFormValues {
  return {
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    type: user?.globalRole === 'super_admin' ? 'super_admin' : activeTab,
    status: user?.status || 'active',
    organizationId: '',
    employeeId: '',
  }
}

/** Create / edit a user login. Re-seeds each time the dialog opens. */
export function useUserForm({
  open,
  user,
  activeTab,
  onDone,
}: {
  open: boolean
  user: User | null
  activeTab: UserRoleType
  onDone: () => void
}) {
  const { isSuperAdmin, activeOrganizationId } = useAuthStore()
  const createMutation = useCreateUser(activeOrganizationId || undefined)
  const updateMutation = useUpdateUser(activeOrganizationId || undefined)
  const isEditing = !!user

  const schema = useMemo(
    () =>
      makeUserSchema({
        isEditing,
        needsOrganization: isSuperAdmin && !activeOrganizationId,
      }),
    [isEditing, isSuperAdmin, activeOrganizationId],
  )

  const form = useForm({
    defaultValues: defaultsFor(user, activeTab),
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value }) => {
      const onSuccess = () => {
        onDone()
        form.reset()
      }
      if (user) {
        updateMutation.mutate(
          {
            id: user.uuid,
            payload: {
              name: value.name,
              email: value.email,
              ...(value.password ? { password: value.password } : {}),
              status: value.status,
              type: value.type as UserRoleType,
            },
          },
          { onSuccess },
        )
      } else {
        createMutation.mutate(
          {
            name: value.name,
            email: value.email,
            password: value.password,
            type: value.type as UserRoleType,
            ...(value.type === 'employee'
              ? { employeeId: value.employeeId }
              : {}),
            ...(value.organizationId
              ? { organizationId: value.organizationId }
              : {}),
          },
          { onSuccess },
        )
      }
    },
  })

  useEffect(() => {
    if (open) form.reset(defaultsFor(user, activeTab))
  }, [open, user, activeTab, form])

  const selectedType = useStore(form.store, (s) => s.values.type)
  const isPending = createMutation.isPending || updateMutation.isPending

  return { form, isEditing, isPending, selectedType, isSuperAdmin }
}
