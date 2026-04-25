import type { ReactNode } from 'react'
import { Building2 } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { LocationSwitcher } from '@/components/layout/LocationSwitcher'

interface TopbarProps {

  actions?: ReactNode
}

export function Topbar({}: TopbarProps) {
  const { activeOrganizationId, accessibleOrganizations } = useAuthStore()

  // Find active organization
  const activeOrg = accessibleOrganizations.find(
    (o) => o.id === activeOrganizationId,
  )

  return (
    <header className="h-16 bg-background/80 backdrop-blur-md border-b border-border/60 flex items-center justify-between px-6 sticky top-0 z-50">
      {/* Left: Spacer to keep center perfectly aligned */}
      <div className="flex-1" />

      {/* Center: Organization Name - Premium Styled */}
      <div className="flex-[2] flex justify-center items-center">
        <div className="flex items-center gap-3 group cursor-default">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-300">
            <Building2 className="w-5 h-5 text-primary relative z-10" />
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent tracking-tight">
              {activeOrg?.name || 'Organization'}
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80 font-bold leading-none mt-0.5">
              Workspace
            </span>
          </div>
        </div>
      </div>

      {/* Right: Location Selector - Clean and accessible */}
      <div className="flex-1 flex justify-end items-center gap-4">
        <LocationSwitcher />
      </div>
    </header>
  )
}
