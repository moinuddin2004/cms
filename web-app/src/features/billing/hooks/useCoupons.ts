import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import * as api from '../services/billing.api'
import type { Coupon } from '../types'

const COUPONS_KEY = 'coupons'

function errMsg(e: any, fb: string) {
  return e?.response?.data?.message || fb
}

export function useCoupons() {
  const { activeOrganizationId } = useAuthStore()
  return useQuery({
    queryKey: [COUPONS_KEY, activeOrganizationId],
    queryFn: () => api.fetchCoupons(),
    enabled: !!activeOrganizationId,
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: [COUPONS_KEY] })
}

export function useCreateCoupon() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (payload: Parameters<typeof api.createCoupon>[0]) =>
      api.createCoupon(payload),
    onSuccess: () => {
      invalidate()
      toast.success('Coupon created')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to create coupon')),
  })
}

export function useUpdateCoupon() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Coupon> }) =>
      api.updateCoupon(id, payload),
    onSuccess: () => {
      invalidate()
      toast.success('Coupon updated')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to update coupon')),
  })
}

export function useDeactivateCoupon() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api.deactivateCoupon(id),
    onSuccess: () => {
      invalidate()
      toast.success('Coupon deactivated')
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to deactivate coupon')),
  })
}
