import type { ReactNode } from 'react'
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
import { PatientBillingTab } from '@/features/billing'
// import { PatientMessagesCard } from '@/features/notifications' // hidden: in-app only
import { useAccess } from '@/features/access/hooks/useAccess'
import type { Patient } from '../types'
import { visiblePatientTabs } from '../utils/patientTabs'
import type { PatientTab } from '../utils/patientTabs'
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

const TAB_LABELS: Record<PatientTab, { label: string; icon?: ReactNode }> = {
  overview: { label: 'Overview' },
  appointments: {
    label: 'Appointments',
    icon: <CalendarClock size={14} className="mr-1.5" />,
  },
  visits: {
    label: 'Visits',
    icon: <CalendarCheck2 size={14} className="mr-1.5" />,
  },
  treatments: {
    label: 'Treatments',
    icon: <Syringe size={14} className="mr-1.5" />,
  },
  'vitals-dental': {
    label: 'Vitals & Dental',
    icon: <Activity size={14} className="mr-1.5" />,
  },
  'teeth-chart': {
    label: 'Teeth Chart',
    icon: <Stethoscope size={14} className="mr-1.5" />,
  },
  clinical: {
    label: 'Clinical & Rx',
    icon: <ClipboardList size={14} className="mr-1.5" />,
  },
  consents: {
    label: 'Consents',
    icon: <FileSignature size={14} className="mr-1.5" />,
  },
  billing: {
    label: 'Billing',
    icon: <HandCoins size={14} className="mr-1.5" />,
  },
  files: {
    label: 'Files',
    icon: <FolderOpen size={14} className="mr-1.5" />,
  },
}

export function PatientDetailTabs({ patient }: PatientDetailTabsProps) {
  const access = useAccess()
  const tabs = visiblePatientTabs(access)
  // Fees are for `patients.price.view` holders (the API strips them too).
  const hideAmounts = !access.can('patients.price.view')

  const content: Record<PatientTab, ReactNode> = {
    overview: (
      <>
        <OverviewTab patient={patient} />
        {/* WhatsApp/SMS opt-outs + message history: hidden while
            notifications are in-app only (no patient channels).
        {access.can('patients.edit') && (
          <PatientMessagesCard patientId={patient.id} />
        )} */}
      </>
    ),
    appointments: <AppointmentsTab patient={patient} />,
    visits: <VisitsTab patient={patient} hideAmounts={hideAmounts} />,
    treatments: <TreatmentsTab patient={patient} hideAmounts={hideAmounts} />,
    'vitals-dental': <VitalsAndDentalTab patient={patient} />,
    'teeth-chart': <TeethChartTab patient={patient} />,
    clinical: <ClinicalTab patient={patient} />,
    consents: <ConsentsTab patient={patient} />,
    billing: (
      <PatientBillingTab
        patient={{
          id: patient.id,
          name: patient.fullName,
          phone: patient.phone,
          mrn: patient.patientNumber,
        }}
      />
    ),
    files: <FilesTab patient={patient} />,
  }

  return (
    <Tabs defaultValue="overview" className="mt-6">
      <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1 justify-start">
        {tabs.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="text-sm">
            {TAB_LABELS[tab].icon}
            {TAB_LABELS[tab].label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent key={tab} value={tab}>
          {content[tab]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
