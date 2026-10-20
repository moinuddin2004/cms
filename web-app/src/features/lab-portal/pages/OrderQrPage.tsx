import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { QrCode } from 'lucide-react'
import { EmptyState, LoadingSkeleton } from '@/components/shared'
import apiClient from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'
import { orderLinkApi } from '../services/lab-portal-orders.api'

/**
 * Where a scanned work-order QR (`/o/:orderId`) lands: the server says
 * whether this user opens it as the lab (portal order, switching to that
 * lab) or as the clinic (clinic order, switching org / location if needed).
 */
export function OrderQrPage({ orderId }: { orderId: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const go = async () => {
      try {
        const t = await orderLinkApi.resolve(orderId)
        if (cancelled) return
        const store = useAuthStore.getState()
        if (t.target === 'lab') {
          store.setActiveLab(t.labId)
          await navigate({
            to: '/lab-portal/orders/$orderId',
            params: { orderId },
            replace: true,
          })
          return
        }
        if (
          store.activeOrganizationId !== t.organizationId ||
          !store.activeLocationId
        ) {
          await apiClient.post('/auth/switch-location', {
            organizationId: t.organizationId,
            locationId: t.locationId,
          })
          store.setLocationContext(t.organizationId, t.locationId)
          await queryClient.invalidateQueries()
        }
        await navigate({
          to: '/lab-orders/$orderId',
          params: { orderId },
          replace: true,
        })
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    void go()
    return () => {
      cancelled = true
    }
  }, [orderId, navigate, queryClient])

  return (
    <div className="mx-auto max-w-xl p-6">
      {failed ? (
        <EmptyState
          icon={QrCode}
          title="Order not found"
          description="This work order belongs to a clinic or lab you don’t have access to."
        />
      ) : (
        <LoadingSkeleton variant="cards" />
      )}
    </div>
  )
}
