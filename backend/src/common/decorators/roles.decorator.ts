/**
 * Metadata key of the removed `@Roles()` decorator. Kept only so specs can
 * assert that no handler still carries it; access is `@Can` / `@AnyMember`.
 */
export const REQUIRED_ROLES_KEY = 'requiredAppRoles';
