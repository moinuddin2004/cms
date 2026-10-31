import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/store/useAuthStore'
import {
  useOrgTheme,
  usePlatformTheme,
  useSaveOrgTheme,
  useSavePlatformTheme,
} from '../hooks/useThemeQueries'
import { LocationThemeSheet } from '../components/LocationThemeSheet'
import { ThemeEditor } from '../components/ThemeEditor'

/** `/settings/theme` — clinic branding; super admins also edit platform defaults. */
export function ThemeBuilderPage() {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin)
  const [locationsOpen, setLocationsOpen] = useState(false)

  const org = useOrgTheme(orgId)
  const saveOrg = useSaveOrgTheme()
  const platform = usePlatformTheme(isSuperAdmin)
  const savePlatform = useSavePlatformTheme()

  const clinic = (
    <ThemeEditor
      scope="org"
      view={org.data}
      isLoading={org.isLoading}
      isError={org.isError}
      onRetry={() => void org.refetch()}
      onSave={saveOrg.mutateAsync}
      isSaving={saveOrg.isPending}
    />
  )

  return (
    <DashboardLayout
      title="Branding & theme"
      subtitle="Your clinic's name, logo, colours and look — for staff screens, the login page and printouts."
      backTo="/settings"
      backLabel="Back to settings"
      actions={
        <Button variant="outline" onClick={() => setLocationsOpen(true)}>
          <MapPin className="size-4" />
          Location overrides
        </Button>
      }
    >
      {isSuperAdmin ? (
        <Tabs defaultValue="clinic" className="space-y-4">
          <TabsList>
            <TabsTrigger value="clinic">This clinic</TabsTrigger>
            <TabsTrigger value="platform">Platform default</TabsTrigger>
          </TabsList>
          <TabsContent value="clinic">{clinic}</TabsContent>
          <TabsContent value="platform">
            <p className="mb-4 text-sm text-muted-foreground">
              Applies to every clinic that hasn&apos;t set its own value. Lock a
              key to stop clinics changing it.
            </p>
            <ThemeEditor
              scope="platform"
              view={platform.data}
              isLoading={platform.isLoading}
              isError={platform.isError}
              onRetry={() => void platform.refetch()}
              onSave={savePlatform.mutateAsync}
              isSaving={savePlatform.isPending}
            />
          </TabsContent>
        </Tabs>
      ) : (
        clinic
      )}

      <LocationThemeSheet
        open={locationsOpen}
        onOpenChange={setLocationsOpen}
      />
    </DashboardLayout>
  )
}
