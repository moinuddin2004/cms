import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import type {
  UserRoleType,
  PaginatedUsersResponse,
  CreateUserPayload,
  StaffCandidate,
  UpdateUserPayload,
} from './types'

// Depending on the auth context of the UI, orgId may be passed through active organization context.
export const useUsers = (
  type: UserRoleType,
  page = 1,
  limit = 10,
  orgId?: string,
) => {
  return useQuery({
    queryKey: ['users', type, page, limit, orgId],
    queryFn: async () => {
      const headers = orgId ? { 'x-organization-id': orgId } : undefined
      const res = await apiClient.get<PaginatedUsersResponse>('/user', {
        params: { type, page, limit },
        headers,
      })
      return res.data
    },
  })
}

/** Employees of the org without a login (choices for a staff user). */
export const useStaffCandidates = (
  orgId: string | undefined,
  enabled: boolean,
) =>
  useQuery({
    queryKey: ['users', 'staff-candidates', orgId],
    queryFn: async () => {
      const res = await apiClient.get('/user/staff-candidates', {
        headers: orgId ? { 'x-organization-id': orgId } : undefined,
      })
      return res.data as StaffCandidate[]
    },
    enabled: enabled && !!orgId,
  })

export const useCreateUser = (defaultOrgId?: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      payload: CreateUserPayload & { organizationId?: string },
    ) => {
      const { organizationId, ...rest } = payload
      const headers =
        organizationId || defaultOrgId
          ? { 'x-organization-id': organizationId || defaultOrgId }
          : undefined
      const res = await apiClient.post('/user', rest, { headers })
      return res.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users', variables.type] })
      // A staff login takes that employee off the candidates list.
      queryClient.invalidateQueries({ queryKey: ['users', 'staff-candidates'] })
    },
  })
}

export const useUpdateUser = (orgId?: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: UpdateUserPayload
    }) => {
      const headers = orgId ? { 'x-organization-id': orgId } : undefined
      const res = await apiClient.patch(`/user/${id}`, payload, { headers })
      return res.data
    },
    onSuccess: () => {
      // Need to invalidate all user types or we can specific if we know
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

/** Email the user a fresh verification link (manager of that user). */
export const useResendUserVerification = (orgId?: string) =>
  useMutation({
    mutationFn: async (id: string) => {
      const headers = orgId ? { 'x-organization-id': orgId } : undefined
      const res = await apiClient.post<{ sent: boolean }>(
        `/user/${id}/resend-verification`,
        undefined,
        { headers },
      )
      return res.data
    },
  })

/** Super admin: mark a user's email verified without the link. */
export const useMarkEmailVerified = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/user/${id}/verify-email`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export const useDeleteUser = (orgId?: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const headers = orgId ? { 'x-organization-id': orgId } : undefined
      const res = await apiClient.delete(`/user/${id}`, { headers })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
