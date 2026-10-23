import { useAuthStore } from '@/store/useAuthStore'

/** Shown when no clinic is active (or it predates the currency field). */
export const DEFAULT_CURRENCY = 'PKR'

/** The active clinic's currency code (organizations.currency), e.g. "PKR". */
export function activeCurrency(): string {
  const { accessibleOrganizations, activeOrganizationId } =
    useAuthStore.getState()
  return (
    accessibleOrganizations.find((o) => o.id === activeOrganizationId)
      ?.currency || DEFAULT_CURRENCY
  )
}

/** Hook form of `activeCurrency()` — re-renders when the clinic changes. */
export function useCurrency(): string {
  return useAuthStore(
    (s) =>
      s.accessibleOrganizations.find((o) => o.id === s.activeOrganizationId)
        ?.currency || DEFAULT_CURRENCY,
  )
}
