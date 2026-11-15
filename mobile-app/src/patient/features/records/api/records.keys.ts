/**
 * Patient record query keys. Every key carries the ACCOUNT id (docs/04 §7) so a
 * different account on the same phone can never see another's cache. The root
 * (`records-*`) decides what may be persisted (`patient/lib/persist.ts`).
 */
type Id = string | null;

export const recordKeys = {
  appointments: (accountId: Id, profileId: Id) => ['records-appointments', accountId, profileId] as const,
  /** Upcoming only — the one appointments query kept in the offline cache (docs/02 §9). */
  appointmentsUpcoming: (accountId: Id, profileId: Id) =>
    ['records-appointments-upcoming', accountId, profileId] as const,
  visits: (accountId: Id, profileId: Id) => ['records-visits', accountId, profileId] as const,
  prescriptions: (accountId: Id, profileId: Id) =>
    ['records-prescriptions', accountId, profileId] as const,
  prescription: (accountId: Id, id: string) => ['records-prescription', accountId, id] as const,
  billing: (accountId: Id, profileId: Id) => ['records-billing', accountId, profileId] as const,
};
