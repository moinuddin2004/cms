import { create } from 'zustand';

interface Organization {
  id: string;
  name: string;
  slug: string;
  accessSource: 'super_admin' | 'owner' | 'employee';
  locations: Location[];
}

interface Location {
  id: string;
  name: string;
  code: string;
  isMainBranch: boolean;
  accessSource: 'super_admin' | 'owner' | 'employee';
  isPrimary: boolean;
}

interface User {
  uuid: string;
  userUuid?: string;
  email: string;
  name: string;
  globalRole: string | null;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  
  // Access context
  isSuperAdmin: boolean;
  accessSource: 'super_admin' | 'owner' | 'employee' | null;
  requiresOrgSelection: boolean;
  requiresLocationSelection: boolean;
  accessibleOrganizations: Organization[];
  activeOrganizationId: string | null;
  activeLocationId: string | null;

  setAuth: (data: { 
    user: User; 
    accessToken: string;
    isSuperAdmin?: boolean;
    accessSource?: 'super_admin' | 'owner' | 'employee' | null;
    requiresOrgSelection?: boolean;
    requiresLocationSelection?: boolean;
    accessibleOrganizations?: Organization[];
    activeOrganizationId?: string | null;
    activeLocationId?: string | null;
  }) => void;
  
  setAccessToken: (token: string) => void;
  
  setLocationContext: (orgId: string, locId: string) => void;
  
  clearAuth: () => void;
}

/**
 * Auth store — memory only, NO persist/localStorage.
 * Access token lives only in Zustand memory.
 * Refresh token lives only in httpOnly cookie (handled by browser).
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  
  isSuperAdmin: false,
  accessSource: null,
  requiresOrgSelection: false,
  requiresLocationSelection: false,
  accessibleOrganizations: [],
  activeOrganizationId: null,
  activeLocationId: null,

  setAuth: (data) =>
    set({
      user: {
        uuid: data.user.uuid || data.user.userUuid || '',
        email: data.user.email,
        name: data.user.name,
        globalRole: data.user.globalRole || null,
        avatarUrl: data.user.avatarUrl,
      },
      accessToken: data.accessToken,
      isAuthenticated: true,
      isSuperAdmin: data.isSuperAdmin || false,
      accessSource: data.accessSource || null,
      requiresOrgSelection: data.requiresOrgSelection || false,
      requiresLocationSelection: data.requiresLocationSelection || false,
      accessibleOrganizations: data.accessibleOrganizations || [],
      activeOrganizationId: data.activeOrganizationId || null,
      activeLocationId: data.activeLocationId || null,
    }),
    
  setAccessToken: (token) =>
    set({ accessToken: token }),
    
  setLocationContext: (orgId, locId) =>
    set({ 
      activeOrganizationId: orgId, 
      activeLocationId: locId,
      requiresOrgSelection: false,
      requiresLocationSelection: false,
    }),
    
  clearAuth: () =>
    set({ 
      user: null, 
      accessToken: null, 
      isAuthenticated: false,
      isSuperAdmin: false,
      accessSource: null,
      requiresOrgSelection: false,
      requiresLocationSelection: false,
      accessibleOrganizations: [],
      activeOrganizationId: null,
      activeLocationId: null,
    }),
}));
