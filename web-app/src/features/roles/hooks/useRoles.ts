import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rolesApi } from '../api/roles.api'
import type {
  CloneRoleInput,
  CreateRoleInput,
  UpdateRoleInput,
} from '../types/roles.types'

export const roleKeys = {
  all: ['admin-roles'] as const,
  list: () => [...roleKeys.all, 'list'] as const,
  detail: (id: string) => [...roleKeys.all, 'detail', id] as const,
}

export function useRoles() {
  return useQuery({ queryKey: roleKeys.list(), queryFn: rolesApi.list })
}

export function useRole(id: string) {
  return useQuery({
    queryKey: roleKeys.detail(id),
    queryFn: () => rolesApi.get(id),
  })
}

/** Role writes refresh the roles screen and the legacy employee-form picker. */
function useInvalidateRoles() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: roleKeys.all })
    void qc.invalidateQueries({ queryKey: ['employment-roles'] })
  }
}

export function useCreateRole() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (input: CreateRoleInput) => rolesApi.create(input),
    onSuccess: (role) => {
      invalidate()
      toast.success(`Role "${role.name}" created`)
    },
  })
}

export function useCloneRole() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: ({ id, ...input }: CloneRoleInput & { id: string }) =>
      rolesApi.clone(id, input),
    onSuccess: (role) => {
      invalidate()
      toast.success(`Role "${role.name}" created`)
    },
  })
}

export function useUpdateRole(id: string) {
  const qc = useQueryClient()
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (input: UpdateRoleInput) => rolesApi.update(id, input),
    onSuccess: (role) => {
      qc.setQueryData(roleKeys.detail(id), role)
      invalidate()
      toast.success('Role saved')
    },
  })
}

export function useDeleteRole() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => {
      invalidate()
      toast.success('Role deleted')
    },
  })
}
