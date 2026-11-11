import type { Organization } from '@/staff/store/useStaffAuthStore';

export interface LocationOption {
  organizationId: string;
  locationId: string;
  label: string;
  current: boolean;
}

/**
 * Every place the user may work in. Clinics that cannot be opened for this
 * session (`signInBlock`) are left out, like the select-location screen does.
 * With several clinics the label carries the clinic name.
 */
export function locationOptions(
  organizations: Organization[],
  activeOrganizationId: string | null,
  activeLocationId: string | null,
): LocationOption[] {
  const open = organizations.filter((o) => !o.signInBlock);
  return open.flatMap((org) =>
    org.locations.map((loc) => ({
      organizationId: org.id,
      locationId: loc.id,
      label: open.length > 1 ? `${org.name} · ${loc.name}` : loc.name,
      current: org.id === activeOrganizationId && loc.id === activeLocationId,
    })),
  );
}
