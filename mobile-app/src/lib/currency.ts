import { activeOrganization, useAuthStore } from '@/store/useAuthStore';

/** Shown when no clinic is active (or it predates the currency field). */
export const DEFAULT_CURRENCY = 'PKR';

/** The active clinic's currency code, e.g. "PKR". */
export const activeCurrency = () =>
  activeOrganization(useAuthStore.getState())?.currency || DEFAULT_CURRENCY;

/** Hook form — re-renders when the clinic changes. */
export const useCurrency = () =>
  useAuthStore((s) => activeOrganization(s)?.currency || DEFAULT_CURRENCY);

/** "PKR 12,500" in the active clinic's currency. */
export const formatCurrency = (amount: number) =>
  `${activeCurrency()} ${amount.toLocaleString('en-PK')}`;
