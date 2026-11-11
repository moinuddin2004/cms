import { formatMoney } from '@/core/money/format';
import { activeOrganization, useStaffAuthStore } from '@/staff/store/useStaffAuthStore';

/** Shown when no clinic is active (or it predates the currency field). */
export const DEFAULT_CURRENCY = 'PKR';

/** The active clinic's currency code, e.g. "PKR". */
export const activeCurrency = () =>
  activeOrganization(useStaffAuthStore.getState())?.currency || DEFAULT_CURRENCY;

/** Hook form — re-renders when the clinic changes. */
export const useCurrency = () =>
  useStaffAuthStore((s) => activeOrganization(s)?.currency || DEFAULT_CURRENCY);

/** "PKR 12,500" in the active clinic's currency. */
export const formatCurrency = (amount: number) => formatMoney(amount, activeCurrency());
