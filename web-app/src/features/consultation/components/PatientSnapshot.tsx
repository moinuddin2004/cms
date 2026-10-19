import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { Activity, CalendarCheck2, Pill, Repeat, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Skeleton } from '@/components/ui/skeleton'
import type { Patient, PatientVitals } from '@/features/patients'
import { usePatientHistory } from '@/features/patients/hooks/usePatientSubEntities'
import {
  PrescriptionStatus,
  usePrescriptionsByPatient,
} from '@/features/prescriptions'
import type { PrescriptionMedicine } from '@/features/prescriptions'
import type { RecordTab } from './RecordDrawer'
import { Panel } from './Panel'

const day = (iso: string) => format(new Date(iso), 'dd MMM yyyy')

/**
 * Everything the doctor wants to glance at while treating: latest vitals,
 * earlier visits and earlier prescriptions. An old prescription can be
 * reused with one tap, so reading turns straight into doing.
 */
export function PatientSnapshot({
  patient,
  encounterId,
  vitals,
  onOpenRecord,
  onUseMedicines,
}: {
  patient: Patient
  encounterId: string
  vitals: PatientVitals | null
  onOpenRecord: (tab: RecordTab) => void
  onUseMedicines: (medicines: PrescriptionMedicine[]) => void
}) {
  const { data: history, isLoading: loadingHistory } = usePatientHistory(
    patient.id,
  )
  const { data: rxData } = usePrescriptionsByPatient(patient.id, 1, 5)

  const pastVisits = (history?.encounters ?? [])
    .filter((e) => e.id !== encounterId)
    .slice(0, 4)

  const pastRx = (rxData?.data ?? [])
    .filter(
      (p) =>
        p.encounterId !== encounterId &&
        p.status !== PrescriptionStatus.DRAFT &&
        p.medicines.length > 0,
    )
    .slice(0, 3)

  return (
    <Panel
      icon={<UserRound />}
      title="Patient at a glance"
      bodyClassName="divide-y divide-border p-0"
    >
      <Section
        icon={<Activity />}
        title="Latest vitals"
        action={
          <SectionAction onClick={() => onOpenRecord('vitals')}>
            {vitals ? 'Update' : 'Record'}
          </SectionAction>
        }
      >
        {vitals ? (
          <>
            <dl className="grid grid-cols-3 gap-1.5 text-center">
              <Vital
                label="BP"
                value={
                  vitals.bpSystolic != null && vitals.bpDiastolic != null
                    ? `${vitals.bpSystolic}/${vitals.bpDiastolic}`
                    : null
                }
              />
              <Vital label="Pulse" value={vitals.pulseRate} />
              <Vital label="Temp °C" value={vitals.temperature} />
              <Vital label="SpO₂ %" value={vitals.oxygenSaturation} />
              <Vital label="Weight kg" value={vitals.weightKg} />
              <Vital label="Height cm" value={vitals.heightCm} />
            </dl>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Recorded {day(vitals.recordedAt)}
            </p>
          </>
        ) : (
          <Empty>No vitals recorded yet.</Empty>
        )}
      </Section>

      <Section
        icon={<CalendarCheck2 />}
        title="Earlier visits"
        action={
          pastVisits.length > 0 ? (
            <SectionAction onClick={() => onOpenRecord('history')}>
              See all
            </SectionAction>
          ) : undefined
        }
      >
        {loadingHistory ? (
          <Skeleton className="h-10 w-full" />
        ) : pastVisits.length === 0 ? (
          <Empty>First visit — nothing earlier on record.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {pastVisits.map((e) => (
              <li key={e.id} className="rounded-md bg-muted/40 px-2.5 py-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[13px] font-medium">
                    {e.diagnosis || e.chiefComplaint || e.reason || 'Visit'}
                  </p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {day(e.encounterDate)}
                  </span>
                </div>
                {(e.treatments?.length ?? 0) > 0 && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {e.treatments!.map((t) => t.treatmentName).join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Pill />} title="Earlier prescriptions">
        {pastRx.length === 0 ? (
          <Empty>No earlier prescriptions.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {pastRx.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">
                    {p.medicines.map((m) => m.medicineName).join(', ')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {day(p.createdAt)}
                  </p>
                </div>
                <TooltipButton
                  tooltip="Use these medicines again"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-primary-text"
                  onClick={() => onUseMedicines(p.medicines)}
                >
                  <Repeat className="size-4" />
                </TooltipButton>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </Panel>
  )
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="px-4 py-3">
      <div className="mb-1.5 flex min-h-7 items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground [&_svg]:size-3.5">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function SectionAction({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs text-primary-text"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

function Vital({
  label,
  value,
}: {
  label: string
  value: string | number | null
}) {
  return (
    <div className="rounded-md bg-muted/40 px-1 py-1">
      <dd className="text-sm font-semibold tabular-nums">{value ?? '—'}</dd>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-muted-foreground">{children}</p>
}
