import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { Activity, CalendarCheck2, Pill, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Patient, PatientVitals } from '@/features/patients'
import { usePatientHistory } from '@/features/patients/hooks/usePatientSubEntities'
import {
  PrescriptionStatus,
  usePrescriptionsByPatient,
} from '@/features/prescriptions'
import type { PrescriptionMedicine } from '@/features/prescriptions'
import type { RecordTab } from './RecordDrawer'

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
    <div className="space-y-3">
      <Card
        icon={<Activity className="size-4" />}
        title="Latest vitals"
        action={
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3"
            onClick={() => onOpenRecord('vitals')}
          >
            {vitals ? 'Update' : 'Record'}
          </Button>
        }
      >
        {vitals ? (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center">
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
            <p className="mt-2 text-xs text-muted-foreground">
              Recorded {day(vitals.recordedAt)}
            </p>
          </>
        ) : (
          <Empty>No vitals recorded yet.</Empty>
        )}
      </Card>

      <Card
        icon={<CalendarCheck2 className="size-4" />}
        title="Earlier visits"
        action={
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-3"
            onClick={() => onOpenRecord('history')}
          >
            See all
          </Button>
        }
      >
        {loadingHistory ? (
          <Skeleton className="h-16 w-full" />
        ) : pastVisits.length === 0 ? (
          <Empty>First visit — nothing earlier on record.</Empty>
        ) : (
          <ul className="space-y-2">
            {pastVisits.map((e) => (
              <li
                key={e.id}
                className="rounded-md border border-border px-3 py-2"
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  {day(e.encounterDate)}
                </p>
                <p className="text-sm font-medium">
                  {e.diagnosis || e.chiefComplaint || e.reason || 'Visit'}
                </p>
                {(e.treatments?.length ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {e.treatments!.map((t) => t.treatmentName).join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card icon={<Pill className="size-4" />} title="Earlier prescriptions">
        {pastRx.length === 0 ? (
          <Empty>No earlier prescriptions.</Empty>
        ) : (
          <ul className="space-y-2">
            {pastRx.map((p) => (
              <li
                key={p.id}
                className="rounded-md border border-border px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {day(p.createdAt)}
                    </p>
                    <p className="text-sm">
                      {p.medicines.map((m) => m.medicineName).join(', ')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 px-3"
                    onClick={() => onUseMedicines(p.medicines)}
                  >
                    <Repeat className="size-3.5" /> Use again
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Card({
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
    <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <span className="text-primary-text">{icon}</span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
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
    <div className="rounded-md bg-muted/40 px-1 py-1.5">
      <dd className="text-base font-semibold">{value ?? '—'}</dd>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
