import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/useAuthStore'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { Building2, MapPin, ChevronDown, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LocationSwitcher() {
  const [isLoading, setIsLoading] = useState(false)
  const {
    accessibleOrganizations,
    activeOrganizationId,
    activeLocationId,
    setLocationContext,
  } = useAuthStore()

  // Derive current names
  const activeOrg = accessibleOrganizations.find(
    (o) => o.id === activeOrganizationId,
  )
  const activeLoc = activeOrg?.locations.find((l) => l.id === activeLocationId)

  // Count total locations across all orgs
  const totalLocations = accessibleOrganizations.reduce(
    (sum, org) => sum + org.locations.length,
    0,
  )

  // Don't render switcher if user has only one location
  if (totalLocations <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
        <MapPin className="w-4 h-4" />
        <span className="font-medium text-foreground">
          {activeLoc?.name || 'Location'}
        </span>
      </div>
    )
  }

  const handleSwitch = async (orgId: string, locId: string) => {
    if (orgId === activeOrganizationId && locId === activeLocationId) return

    setIsLoading(true)
    try {
      const res = await apiClient.post('/auth/switch-location', {
        organizationId: orgId,
        locationId: locId,
      })

      if (res.data?.isSuccess) {
        setLocationContext(orgId, locId)

        // Invalidate all queries so data is refetched for new location
        queryClient.invalidateQueries()

        const org = accessibleOrganizations.find((o) => o.id === orgId)
        const loc = org?.locations.find((l) => l.id === locId)
        toast.success('Location switched', {
          description: `Now working in ${loc?.name || 'selected location'}`,
        })
      }
    } catch (err: any) {
      toast.error('Failed to switch location', {
        description: err.response?.data?.message || 'Please try again',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-9 px-3 border-border/60 bg-background/60 hover:bg-background/90 transition-all"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MapPin className="w-4 h-4 text-primary" />
          )}
          <span className="max-w-[160px] truncate font-medium">
            {activeLoc?.name || 'Select Location'}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[260px]">
        {accessibleOrganizations.map((org, idx) => (
          <div key={org.id}>
            {/* Show org name as label if multiple orgs */}
            {accessibleOrganizations.length > 1 && (
              <>
                {idx > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Building2 className="w-3 h-3" />
                  {org.name}
                </DropdownMenuLabel>
              </>
            )}
            {org.locations.map((loc) => {
              const isActive =
                org.id === activeOrganizationId && loc.id === activeLocationId
              return (
                <DropdownMenuItem
                  key={loc.id}
                  onClick={() => handleSwitch(org.id, loc.id)}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer',
                    isActive && 'bg-primary/5 text-primary font-medium',
                  )}
                >
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">{loc.name}</span>
                  {isActive && (
                    <Check className="w-4 h-4 shrink-0 text-primary" />
                  )}
                </DropdownMenuItem>
              )
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
