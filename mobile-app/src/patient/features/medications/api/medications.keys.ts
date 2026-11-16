/**
 * Medication query keys. Every key carries the ACCOUNT id (docs/04 §7). The roots
 * (`medications`, `dose-events`) are on the patient persist allow-list.
 */
type Id = string | null;

export const medicationKeys = {
  all: (accountId: Id) => ['medications', accountId] as const,
  /** One window of server-known dose events, named by its first local day (`YYYY-MM-DD`). */
  doseEvents: (accountId: Id, fromYmd: string) => ['dose-events', accountId, fromYmd] as const,
};
