type Id = string | null;

/** Org + location + clinic day in every key (docs/04 §7). Not persisted (money). */
export const todayKeys = {
  all: ['today'] as const,
  collections: (orgId: Id, locationId: Id, ymd: string, source: 'daily' | 'invoices') =>
    ['today', 'collections', orgId, locationId, ymd, source] as const,
  doctorsNow: (orgId: Id, locationId: Id, ymd: string) =>
    ['today', 'doctors-now', orgId, locationId, ymd] as const,
};
