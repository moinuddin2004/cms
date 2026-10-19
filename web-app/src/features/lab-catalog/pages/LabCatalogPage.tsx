import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ClinicServicesTab } from '../components/ClinicServicesTab'
import { MappingsTab } from '../components/MappingsTab'

/**
 * The clinic's lab price list: what each lab charges this clinic, what the
 * patient pays (the mapped treatment), and the mappings themselves.
 */
export function LabCatalogPage() {
  return (
    <DashboardLayout
      title="Lab price list"
      subtitle="Lab costs, patient prices and which lab makes each treatment."
    >
      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Lab services</TabsTrigger>
          <TabsTrigger value="mappings">Treatment mapping</TabsTrigger>
        </TabsList>
        <TabsContent value="services" className="pt-4">
          <ClinicServicesTab />
        </TabsContent>
        <TabsContent value="mappings" className="pt-4">
          <MappingsTab />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  )
}
