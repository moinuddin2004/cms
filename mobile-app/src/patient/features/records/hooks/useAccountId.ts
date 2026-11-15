import { usePatientAuthStore } from '@/patient/store/usePatientAuthStore';

/** The signed-in patient account id — part of every records query key. */
export const useAccountId = (): string | null => usePatientAuthStore((s) => s.account?.id ?? null);
