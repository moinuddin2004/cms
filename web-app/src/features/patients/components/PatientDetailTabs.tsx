import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Stethoscope,
  ClipboardList,
  FolderOpen,
  Activity,
  FileSignature,
} from 'lucide-react'
import type { Patient } from '../types'
import { OverviewTab } from './tabs/OverviewTab'
import { VitalsAndDentalTab } from './tabs/VitalsAndDentalTab'
import { TeethChartTab } from './tabs/TeethChartTab'
import { TreatmentPlansTab } from './tabs/TreatmentPlansTab'
import { ClinicalTab } from './tabs/ClinicalTab'
import { ConsentsTab } from './tabs/ConsentsTab'
import { FilesTab } from './tabs/FilesTab'

interface PatientDetailTabsProps {
  patient: Patient
}

export function PatientDetailTabs({ patient }: PatientDetailTabsProps) {
  return (
    <Tabs defaultValue="overview" className="mt-6">
      <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1 justify-start">
        <TabsTrigger value="overview" className="text-sm">
          Overview
        </TabsTrigger>
        <TabsTrigger value="vitals-dental" className="text-sm">
          <Activity size={14} className="mr-1.5" />
          Vitals & Dental
        </TabsTrigger>
        <TabsTrigger value="teeth-chart" className="text-sm">
          <Stethoscope size={14} className="mr-1.5" />
          Teeth Chart
        </TabsTrigger>
        <TabsTrigger value="treatments" className="text-sm">
          <Stethoscope size={14} className="mr-1.5" />
          Treatment Plans
        </TabsTrigger>
        <TabsTrigger value="clinical" className="text-sm">
          <ClipboardList size={14} className="mr-1.5" />
          Clinical & Rx
        </TabsTrigger>
        <TabsTrigger value="consents" className="text-sm">
          <FileSignature size={14} className="mr-1.5" />
          Consents
        </TabsTrigger>
        <TabsTrigger value="files" className="text-sm">
          <FolderOpen size={14} className="mr-1.5" />
          Files
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab patient={patient} />
      </TabsContent>

      <TabsContent value="vitals-dental">
        <VitalsAndDentalTab patient={patient} />
      </TabsContent>

      <TabsContent value="teeth-chart">
        <TeethChartTab patient={patient} />
      </TabsContent>

      <TabsContent value="treatments">
        <TreatmentPlansTab patient={patient} />
      </TabsContent>

      <TabsContent value="clinical">
        <ClinicalTab patient={patient} />
      </TabsContent>

      <TabsContent value="consents">
        <ConsentsTab patient={patient} />
      </TabsContent>

      <TabsContent value="files">
        <FilesTab patient={patient} />
      </TabsContent>
    </Tabs>
  )
}
