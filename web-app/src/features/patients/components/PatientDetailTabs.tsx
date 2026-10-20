import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Stethoscope,
  ClipboardList,
  FolderOpen,
  Activity,
  FileSignature,
  CalendarClock,
  CalendarCheck2,
  Syringe,
  HandCoins,
} from 'lucide-react'
import { PatientBillingTab, useBillingAccess } from '@/features/billing'
import { PatientMessagesCard } from '@/features/notifications'
import type { Patient } from '../types'
import { FeatureGuard } from '@/context/FeatureFlagsContext'
import { OverviewTab } from './tabs/OverviewTab'
import { AppointmentsTab } from './tabs/AppointmentsTab'
import { VisitsTab } from './tabs/VisitsTab'
import { TreatmentsTab } from './tabs/TreatmentsTab'
import { VitalsAndDentalTab } from './tabs/VitalsAndDentalTab'
import { TeethChartTab } from './tabs/TeethChartTab'
import { ClinicalTab } from './tabs/ClinicalTab'
import { ConsentsTab } from './tabs/ConsentsTab'
import { FilesTab } from './tabs/FilesTab'

interface PatientDetailTabsProps {
  patient: Patient
}

export function PatientDetailTabs({ patient }: PatientDetailTabsProps) {
  // Billing is admin + reception only; doctors never see the tab (D17).
  const { canBill } = useBillingAccess()
  return (
    <Tabs defaultValue="overview" className="mt-6">
      <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1 justify-start">
        <TabsTrigger value="overview" className="text-sm">
          Overview
        </TabsTrigger>
        <FeatureGuard feature="appointments.core">
          <TabsTrigger value="appointments" className="text-sm">
            <CalendarClock size={14} className="mr-1.5" />
            Appointments
          </TabsTrigger>
        </FeatureGuard>
        <TabsTrigger value="visits" className="text-sm">
          <CalendarCheck2 size={14} className="mr-1.5" />
          Visits
        </TabsTrigger>
        <TabsTrigger value="treatments" className="text-sm">
          <Syringe size={14} className="mr-1.5" />
          Treatments
        </TabsTrigger>
        <TabsTrigger value="vitals-dental" className="text-sm">
          <Activity size={14} className="mr-1.5" />
          Vitals & Dental
        </TabsTrigger>
        <FeatureGuard feature="patients.teeth_chart">
          <TabsTrigger value="teeth-chart" className="text-sm">
            <Stethoscope size={14} className="mr-1.5" />
            Teeth Chart
          </TabsTrigger>
        </FeatureGuard>
        <FeatureGuard feature="patients.prescriptions">
          <TabsTrigger value="clinical" className="text-sm">
            <ClipboardList size={14} className="mr-1.5" />
            Clinical & Rx
          </TabsTrigger>
        </FeatureGuard>
        <TabsTrigger value="consents" className="text-sm">
          <FileSignature size={14} className="mr-1.5" />
          Consents
        </TabsTrigger>
        {canBill && (
          <FeatureGuard feature="billing.invoices">
            <TabsTrigger value="billing" className="text-sm">
              <HandCoins size={14} className="mr-1.5" />
              Billing
            </TabsTrigger>
          </FeatureGuard>
        )}
        <FeatureGuard feature="patients.documents">
          <TabsTrigger value="files" className="text-sm">
            <FolderOpen size={14} className="mr-1.5" />
            Files
          </TabsTrigger>
        </FeatureGuard>
      </TabsList>

      {canBill && (
        <FeatureGuard feature="billing.invoices">
          <TabsContent value="billing">
            <PatientBillingTab
              patient={{
                id: patient.id,
                name: patient.fullName,
                phone: patient.phone,
                mrn: patient.patientNumber,
              }}
            />
          </TabsContent>
        </FeatureGuard>
      )}

      <TabsContent value="overview">
        <OverviewTab patient={patient} />
        {canBill && <PatientMessagesCard patientId={patient.id} />}
      </TabsContent>

      <FeatureGuard feature="appointments.core">
        <TabsContent value="appointments">
          <AppointmentsTab patient={patient} />
        </TabsContent>
      </FeatureGuard>

      <TabsContent value="visits">
        <VisitsTab patient={patient} />
      </TabsContent>

      <TabsContent value="treatments">
        <TreatmentsTab patient={patient} />
      </TabsContent>

      <TabsContent value="vitals-dental">
        <VitalsAndDentalTab patient={patient} />
      </TabsContent>

      <FeatureGuard feature="patients.teeth_chart">
        <TabsContent value="teeth-chart">
          <TeethChartTab patient={patient} />
        </TabsContent>
      </FeatureGuard>

      <FeatureGuard feature="patients.prescriptions">
        <TabsContent value="clinical">
          <ClinicalTab patient={patient} />
        </TabsContent>
      </FeatureGuard>

      <TabsContent value="consents">
        <ConsentsTab patient={patient} />
      </TabsContent>

      <FeatureGuard feature="patients.documents">
        <TabsContent value="files">
          <FilesTab patient={patient} />
        </TabsContent>
      </FeatureGuard>
    </Tabs>
  )
}
