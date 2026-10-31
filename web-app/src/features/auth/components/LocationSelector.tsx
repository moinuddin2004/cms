import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/useAuthStore'
import { useNavigate } from '@tanstack/react-router'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import {
  Building2,
  MapPin,
  Loader2,
  ChevronRight,
  Star,
  ArrowLeft,
  PlusCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AuthLayout } from './AuthLayout'
import { AuthHeading } from './AuthPrimitives'

type Step = 'org' | 'location'

export function LocationSelector() {
  const { accessibleOrganizations, user, isSuperAdmin, setLocationContext } =
    useAuthStore()
  const navigate = useNavigate()

  // Figure out initial step
  const needsOrgStep = isSuperAdmin || accessibleOrganizations.length > 1
  const [step, setStep] = useState<Step>(needsOrgStep ? 'org' : 'location')
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    needsOrgStep ? null : accessibleOrganizations[0]?.id || null,
  )
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedOrg = useMemo(
    () => accessibleOrganizations.find((o) => o.id === selectedOrgId),
    [accessibleOrganizations, selectedOrgId],
  )

  const handleOrgSelect = (orgId: string) => {
    setSelectedOrgId(orgId)
    setSelectedLocId(null)
    const org = accessibleOrganizations.find((o) => o.id === orgId)
    if (org && org.locations.length === 1) {
      // Auto-select single location and submit
      setSelectedLocId(org.locations[0].id)
      handleSubmit(orgId, org.locations[0].id)
    } else {
      setStep('location')
    }
  }

  const handleSubmit = async (orgId?: string, locId?: string) => {
    const finalOrgId = orgId || selectedOrgId
    const finalLocId = locId || selectedLocId
    if (!finalOrgId || !finalLocId) return

    setIsSubmitting(true)
    try {
      const res = await apiClient.post('/auth/select-location', {
        organizationId: finalOrgId,
        locationId: finalLocId,
      })

      if (res.data?.isSuccess) {
        setLocationContext(finalOrgId, finalLocId)
        const orgName = accessibleOrganizations.find(
          (o) => o.id === finalOrgId,
        )?.name
        toast.success('Location selected', {
          description: `You're now working in ${orgName}`,
        })
        navigate({ to: '/' }) // → the user's home page
      }
    } catch (err: any) {
      toast.error('Failed to select location', {
        description: err.response?.data?.message || 'Please try again',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      {/* Header */}
      <AuthHeading
        title={step === 'org' ? 'Choose an organization' : 'Choose a location'}
        subtitle={
          step === 'org'
            ? `Welcome, ${user?.name}. Choose an organization to continue.`
            : `Welcome, ${user?.name}. Choose where you'd like to work today.`
        }
      />

      <div className="space-y-3">
          {/* ── Step 1: Organization Picker ── */}
          {step === 'org' && (
            <>
              {accessibleOrganizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left',
                    'hover:border-primary/40 hover:bg-primary/5 cursor-pointer',
                    selectedOrgId === org.id
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border bg-card',
                  )}
                  onClick={() => handleOrgSelect(org.id)}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                      selectedOrgId === org.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-foreground truncate block">
                      {org.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {org.locations.length} location
                      {org.locations.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground/40" />
                </button>
              ))}
            </>
          )}

          {/* ── Step 2: Location Picker ── */}
          {step === 'location' && selectedOrg && (
            <>
              {/* Back button (only if org step existed) */}
              {needsOrgStep && (
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                  onClick={() => {
                    setStep('org')
                    setSelectedLocId(null)
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to organizations
                </button>
              )}

              {/* Org header */}
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
                <Building2 className="w-4 h-4" />
                {selectedOrg.name}
              </div>

              {/* No locations yet — super admin needs to create one first */}
              {selectedOrg.locations.length === 0 && (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">No locations yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create a location for <span className="font-semibold">{selectedOrg.name}</span> to continue.
                    </p>
                  </div>
                  <Button
                    variant="default"
                    className="gap-2"
                    onClick={() => navigate({ to: '/settings/locations' })}
                  >
                    <PlusCircle className="w-4 h-4" />
                    Create First Location
                  </Button>
                </div>
              )}

              {/* Location cards */}
              {selectedOrg.locations.map((loc) => {
                const isSelected = selectedLocId === loc.id
                return (
                  <button
                    key={loc.id}
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left',
                      'hover:border-primary/40 hover:bg-primary/5 cursor-pointer',
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border bg-card',
                    )}
                    onClick={() => setSelectedLocId(loc.id)}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">
                          {loc.name}
                        </span>
                        {loc.isMainBranch && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber">
                            <Star className="w-3 h-3" />
                            Main
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {loc.code}
                      </span>
                    </div>
                    <ChevronRight
                      className={cn(
                        'w-5 h-5 shrink-0 transition-colors',
                        isSelected
                          ? 'text-primary'
                          : 'text-muted-foreground/40',
                      )}
                    />
                  </button>
                )
              })}

              {/* Submit button */}
              <Button
                className="w-full h-11 font-semibold mt-4 rounded-xl transition-all active:scale-[0.99]"
                disabled={!selectedLocId || isSubmitting}
                onClick={() => handleSubmit()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Selecting...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
            </>
          )}
      </div>
    </AuthLayout>
  )
}
