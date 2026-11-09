import apiClient from '@/lib/api'
import { useAuthStore } from '@/store/useAuthStore'

export function errorMessage(err: unknown) {
  const msg = (
    err as { response?: { data?: { message?: unknown } } } | undefined
  )?.response?.data?.message
  return Array.isArray(msg)
    ? String(msg[0])
    : (msg as string) || 'Could not save. Try again.'
}

/** Re-read the session so the sidebar/forms pick up the new name, currency, specialties. */
export async function refreshSession() {
  try {
    const { data } = await apiClient.get('/auth/me')
    const me = data?.data
    if (!me) return
    const s = useAuthStore.getState()
    s.setAuth({
      user: me.user,
      accessToken: me.accessToken,
      isSuperAdmin: me.isSuperAdmin,
      accessSource: me.accessSource,
      requiresOrgSelection: false,
      requiresLocationSelection: false,
      accessibleOrganizations: me.accessibleOrganizations,
      activeOrganizationId: s.activeOrganizationId,
      activeLocationId: s.activeLocationId,
      labMemberships: me.labMemberships ?? [],
    })
  } catch {
    // The old values stay until the next refresh — harmless.
  }
}
