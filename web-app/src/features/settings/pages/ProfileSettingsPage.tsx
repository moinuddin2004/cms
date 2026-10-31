import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAccess, useMyAccess } from '@/features/access'
import { useAuthStore } from '@/store/useAuthStore'
import { SettingsCard, SettingsRow } from '../components/SettingsCard'

function getInitials(name?: string) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ProfileSettingsPage() {
  const { user, accessibleOrganizations, activeOrganizationId, activeLocationId } =
    useAuthStore()
  const { isSuperAdmin, isOwner } = useAccess()
  // Same cached /me/access payload the AccessProvider loaded.
  const roles = useMyAccess().data?.roles ?? []
  const roleLabel = isSuperAdmin
    ? 'Super admin'
    : isOwner
      ? 'Owner'
      : roles.map((r) => r.name).join(', ') || 'Member'

  const org = accessibleOrganizations.find((o) => o.id === activeOrganizationId)
  const location = org?.locations.find((l) => l.id === activeLocationId)

  return (
    <DashboardLayout
      title="Profile"
      subtitle="How you appear to your team."
    >
      <SettingsCard
        title="Your details"
        description="Ask your clinic admin if your name or email needs to change."
      >
        <div className="mb-5 flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary-text">
            {getInitials(user?.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              {user?.name || '—'}
            </p>
            <p className="truncate text-sm text-text-3">{user?.email || '—'}</p>
          </div>
        </div>
        <div className="divide-y divide-border">
          <SettingsRow label="Role">
            <p className="text-sm text-text-2">{roleLabel}</p>
          </SettingsRow>
          {org && (
            <SettingsRow label="Clinic">
              <p className="text-sm text-text-2">{org.name}</p>
            </SettingsRow>
          )}
          {location && (
            <SettingsRow
              label="Location"
              hint="Switch location from the top bar."
            >
              <p className="text-sm text-text-2">{location.name}</p>
            </SettingsRow>
          )}
        </div>
      </SettingsCard>
    </DashboardLayout>
  )
}
