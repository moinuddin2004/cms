import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Can } from '@/features/access'
import type { Patient } from '@/features/patients'
import { VisitsTab } from '@/features/patients/components/tabs/VisitsTab'
import { TreatmentsTab } from '@/features/patients/components/tabs/TreatmentsTab'
import { VitalsAndDentalTab } from '@/features/patients/components/tabs/VitalsAndDentalTab'
import { TeethChartTab } from '@/features/patients/components/tabs/TeethChartTab'
import { ClinicalTab } from '@/features/patients/components/tabs/ClinicalTab'
import { ConsentsTab } from '@/features/patients/components/tabs/ConsentsTab'
import { FilesTab } from '@/features/patients/components/tabs/FilesTab'

export type RecordTab =
  'history' | 'teeth' | 'vitals' | 'rx' | 'files' | 'consents'

/**
 * The patient's complete record in a slide-over panel. It opens on top of the
 * consultation, so the doctor can look up or add anything (teeth chart,
 * X-rays, vitals, treatments…) and close it to land exactly where they were.
 */
export function RecordDrawer({
  patient,
  tab,
  open,
  onOpenChange,
  onTabChange,
}: {
  patient: Patient
  tab: RecordTab
  open: boolean
  onOpenChange: (open: boolean) => void
  onTabChange: (tab: RecordTab) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-4xl"
      >
        <SheetHeader className="sticky top-0 z-10 gap-0.5 border-b border-border bg-background p-4 pr-12">
          <SheetTitle className="text-base">
            {patient.fullName} — patient record
          </SheetTitle>
          <SheetDescription className="text-xs">
            Look anything up or add to it. Closing this returns to the
            consultation.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => onTabChange(v as RecordTab)}
          className="gap-0 p-4"
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-0.5 p-0.5">
            <RecordTrigger value="history">History</RecordTrigger>
            <Can perm="patients.chart.edit">
              <RecordTrigger value="teeth">Teeth chart</RecordTrigger>
            </Can>
            <RecordTrigger value="vitals">Vitals & dental</RecordTrigger>
            <Can perm="prescriptions.create">
              <RecordTrigger value="rx">Prescriptions</RecordTrigger>
            </Can>
            <Can perm="patients.documents.manage">
              <RecordTrigger value="files">X-rays & files</RecordTrigger>
            </Can>
            <RecordTrigger value="consents">Consents</RecordTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-4">
            <VisitsTab patient={patient} hideAmounts compact />
            <TreatmentsTab patient={patient} hideAmounts />
          </TabsContent>
          <Can perm="patients.chart.edit">
            <TabsContent value="teeth">
              <TeethChartTab patient={patient} />
            </TabsContent>
          </Can>
          <TabsContent value="vitals">
            <VitalsAndDentalTab patient={patient} />
          </TabsContent>
          <Can perm="prescriptions.create">
            <TabsContent value="rx">
              <ClinicalTab patient={patient} />
            </TabsContent>
          </Can>
          <Can perm="patients.documents.manage">
            <TabsContent value="files">
              <FilesTab patient={patient} />
            </TabsContent>
          </Can>
          <TabsContent value="consents">
            <ConsentsTab patient={patient} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function RecordTrigger({
  value,
  children,
}: {
  value: RecordTab
  children: React.ReactNode
}) {
  return (
    <TabsTrigger value={value} className="h-8 flex-none px-3 text-[13px]">
      {children}
    </TabsTrigger>
  )
}
