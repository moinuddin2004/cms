// Roles feature barrel — import from here across features.
export { RolesPage } from './pages/RolesPage'
export { RoleDetailPage } from './pages/RoleDetailPage'
export { roleKeys, useRoles, useRole } from './hooks/useRoles'
export {
  applyLevel,
  bundleSummaryText,
  moduleLevel,
  permissionsOf,
} from './lib/bundles'
export type {
  ModuleLevel,
  RoleDetail,
  RoleMember,
  RoleSummary,
} from './types/roles.types'
