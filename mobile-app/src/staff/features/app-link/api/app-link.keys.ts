type Id = string | null;

/** Carries org + location like every staff patient key (docs/04 §7). */
export const appLinkKeys = {
  status: (orgId: Id, locationId: Id, patientId: string) =>
    ['patients', 'app-link', orgId, locationId, patientId] as const,
};
