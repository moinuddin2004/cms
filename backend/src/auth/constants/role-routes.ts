import { Role } from 'src/user/enum/role.enum';

interface RoleRoute {
  method: string;
  path: string;
  roles: Role[];
}

const ALL_ROLES = [Role.ADMIN, Role.DENTIST, Role.RECEPTIONIST];

export const ROLE_BASED_ROUTES: RoleRoute[] = [
  // ==================== AUTH ====================
  { method: 'GET', path: '/auth/me', roles: ALL_ROLES },
  { method: 'POST', path: '/auth/logout-all', roles: ALL_ROLES },
  { method: 'POST', path: '/auth/change-password', roles: ALL_ROLES },
  { method: 'POST', path: '/auth/add-password', roles: ALL_ROLES },
  { method: 'GET', path: '/auth/sessions', roles: ALL_ROLES },
  { method: 'DELETE', path: '/auth/sessions/:id', roles: ALL_ROLES },
  { method: 'POST', path: '/auth/sessions/revoke-all', roles: ALL_ROLES },

  // ==================== USERS ====================
  { method: 'GET', path: '/users/profile', roles: ALL_ROLES },
  { method: 'POST', path: '/users', roles: [Role.ADMIN] },
  { method: 'PUT', path: '/users/:id', roles: [Role.ADMIN] },
  { method: 'DELETE', path: '/users/:id', roles: [Role.ADMIN] },
  { method: 'POST', path: '/users/search', roles: ALL_ROLES },
  { method: 'POST', path: '/users/find-all', roles: ALL_ROLES },
  { method: 'GET', path: '/users/role-counts', roles: ALL_ROLES },
  { method: 'PATCH', path: '/users/:id/toggle-status', roles: [Role.ADMIN] },
  { method: 'GET', path: '/users/id/:id', roles: ALL_ROLES },
  { method: 'GET', path: '/users/email/:email', roles: ALL_ROLES },
  { method: 'PATCH', path: '/users/:id', roles: [Role.ADMIN] },

  // ==================== PATIENTS ====================
  { method: 'POST', path: '/patients', roles: ALL_ROLES },
  { method: 'GET', path: '/patients', roles: ALL_ROLES },
  { method: 'GET', path: '/patients/check-phone/:phone', roles: ALL_ROLES },
  { method: 'GET', path: '/patients/:id', roles: ALL_ROLES },
  { method: 'PUT', path: '/patients/:id', roles: ALL_ROLES },
  { method: 'PATCH', path: '/patients/:id/toggle-status', roles: ALL_ROLES },
  { method: 'DELETE', path: '/patients/:id', roles: ALL_ROLES },
  { method: 'POST', path: '/patients/search', roles: ALL_ROLES },
  { method: 'POST', path: '/patients/find-all', roles: ALL_ROLES },
  { method: 'GET', path: '/patients/role-counts', roles: ALL_ROLES },
  { method: 'PATCH', path: '/patients/:id', roles: ALL_ROLES },
];
