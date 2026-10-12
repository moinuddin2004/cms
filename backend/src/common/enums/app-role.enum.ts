/**
 * Clinic roles enforced on the server by `RolesGuard`.
 *
 * They are derived per (user, organization, location) — not stored on the
 * user — by `AuthorizationService.resolveActor()`:
 * - super admins and organization owners get every role;
 * - employees get roles from their employment role's permissions.
 */
export enum AppRole {
  CLINIC_ADMIN = 'clinic_admin',
  RECEPTIONIST = 'receptionist',
  DOCTOR = 'doctor',
}

export const ALL_APP_ROLES: AppRole[] = [
  AppRole.CLINIC_ADMIN,
  AppRole.RECEPTIONIST,
  AppRole.DOCTOR,
];

/** Who is acting, resolved for the active organization + location. */
export interface Actor {
  userId: string;
  roles: AppRole[];
  /** The user's employee id at this location, when they have one. */
  employeeId: string | null;
}
