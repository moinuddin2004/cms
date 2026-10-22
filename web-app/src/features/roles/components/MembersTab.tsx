import { Link } from '@tanstack/react-router'
import { MapPin, Users } from 'lucide-react'
import { EmptyState, InitialsAvatar, StatusBadge } from '@/components/shared'
import type { RoleMember } from '../types/roles.types'

/** Who has this role, per location. Roles are assigned on the employee form. */
export function MembersTab({ members }: { members: RoleMember[] }) {
  if (!members.length) {
    return (
      <EmptyState
        icon={Users}
        title="Nobody has this role yet"
        description="Assign roles on each employee's page, per location."
      />
    )
  }

  const byLocation = new Map<string, RoleMember[]>()
  for (const m of members) {
    const list = byLocation.get(m.locationName) ?? []
    list.push(m)
    byLocation.set(m.locationName, list)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-3">
        To change someone's role, open their employee page.
      </p>
      {[...byLocation.entries()].map(([location, list]) => (
        <section
          key={location}
          className="rounded-xl border border-border bg-card shadow-sm"
        >
          <h3 className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-medium">
            <MapPin className="size-4 text-text-3" /> {location}
            <span className="text-xs font-normal text-text-3">
              ({list.length})
            </span>
          </h3>
          <ul>
            {list.map((m) => (
              <li
                key={m.assignmentId}
                className="flex items-center gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-accent/30"
              >
                <InitialsAvatar
                  name={m.employeeName}
                  seed={m.employeeId}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/employees/$employeeId"
                    params={{ employeeId: m.employeeId }}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {m.employeeName}
                  </Link>
                  <p className="truncate text-xs text-text-3">
                    {m.designation}
                  </p>
                </div>
                {!m.hasPortalAccess && (
                  <StatusBadge
                    status="no login"
                    tone="muted"
                    label="No login"
                  />
                )}
                <StatusBadge
                  status={m.isActive ? 'active' : 'inactive'}
                  label={m.isActive ? 'Active' : 'Inactive'}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
