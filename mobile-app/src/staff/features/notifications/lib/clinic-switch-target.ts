import type { Organization } from '@/staff/store/useStaffAuthStore';

export interface ClinicSwitchTarget {
  organizationId: string;
  locationId: string;
}

/**
 * Where to land when switching to another clinic from a notification: the clinic's first
 * location. `null` when the user can't open that clinic (unknown, blocked or no locations).
 */
export function clinicSwitchTarget(
  organizations: Organization[],
  organizationId: string,
): ClinicSwitchTarget | null {
  const org = organizations.find((o) => o.id === organizationId && !o.signInBlock);
  const location = org?.locations.find((l) => l.isPrimary) ?? org?.locations[0];
  return org && location ? { organizationId: org.id, locationId: location.id } : null;
}

/** organizationId → clinic name, for labelling rows from other clinics. */
export function orgNameMap(organizations: Organization[]): Record<string, string> {
  return Object.fromEntries(organizations.map((o) => [o.id, o.name]));
}
