import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import {
  fetchLeaves,
  fetchLeaveBalance,
  createLeave,
  updateLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
} from '../services/leave.api'
import type { LeaveFilterParams, LeaveFormData } from '../types'

export const LEAVES_QUERY_KEY = 'leaves'
export const LEAVE_BALANCE_QUERY_KEY = 'leave-balance'

// ─── Queries ────────────────────────────────────────────────────────

export function useLeaves(params: LeaveFilterParams = {}) {
  const { activeLocationId } = useAuthStore()

  return useQuery({
    queryKey: [LEAVES_QUERY_KEY, activeLocationId, params],
    queryFn: () => fetchLeaves(params),
    enabled: !!activeLocationId,
    staleTime: 60 * 1000,
  })
}

export function useLeaveBalance(employeeId: string) {
  const { activeLocationId } = useAuthStore()

  return useQuery({
    queryKey: [LEAVE_BALANCE_QUERY_KEY, employeeId, activeLocationId],
    queryFn: () => fetchLeaveBalance(employeeId),
    enabled: !!employeeId && !!activeLocationId,
    staleTime: 60 * 1000,
  })
}

// ─── Mutations ──────────────────────────────────────────────────────

function useInvalidateLeaves() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: [LEAVES_QUERY_KEY] })
    queryClient.invalidateQueries({ queryKey: [LEAVE_BALANCE_QUERY_KEY] })
  }
}

export function useCreateLeave() {
  const invalidate = useInvalidateLeaves()

  return useMutation({
    mutationFn: (payload: LeaveFormData & { employeeId: string }) =>
      createLeave(payload),
    onSuccess: () => {
      invalidate()
      toast.success('Leave request created')
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || 'Failed to create leave request',
      )
    },
  })
}

export function useUpdateLeave() {
  const invalidate = useInvalidateLeaves()

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<LeaveFormData>
    }) => updateLeave(id, payload),
    onSuccess: () => {
      invalidate()
      toast.success('Leave request updated')
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || 'Failed to update leave request',
      )
    },
  })
}

export function useApproveLeave() {
  const invalidate = useInvalidateLeaves()

  return useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote?: string }) =>
      approveLeave(id, reviewNote),
    onSuccess: () => {
      invalidate()
      toast.success('Leave request approved')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to approve leave')
    },
  })
}

export function useRejectLeave() {
  const invalidate = useInvalidateLeaves()

  return useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote?: string }) =>
      rejectLeave(id, reviewNote),
    onSuccess: () => {
      invalidate()
      toast.success('Leave request rejected')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to reject leave')
    },
  })
}

export function useCancelLeave() {
  const invalidate = useInvalidateLeaves()

  return useMutation({
    mutationFn: (id: string) => cancelLeave(id),
    onSuccess: () => {
      invalidate()
      toast.success('Leave request cancelled')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to cancel leave')
    },
  })
}
