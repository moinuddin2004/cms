import { useQueueRole } from '@/features/queue/hooks/useQueueRole'

/**
 * Who may see billing at the active location (D17): admin + reception.
 * Doctors see nothing. While roles load, everything reports false so no
 * amount flashes on screen. The API enforces every rule regardless.
 */
export function useBillingAccess() {
  const { isLoading, isAdmin, canReception } = useQueueRole()
  return {
    isLoading,
    canBill: canReception,
    isAdmin,
  }
}
