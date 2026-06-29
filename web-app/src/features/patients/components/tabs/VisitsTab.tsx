import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  ClipboardCheck,
  Banknote,
  Eye,
  CalendarCheck2,
} from 'lucide-react'
import { usePatientHistory } from '../../hooks/usePatientSubEntities'
import type { Patient, Encounter } from '../../types'
import { EncounterDetailDialog } from './EncounterDetailDialog'

const num = (v: number | string | null | undefined) =>
  v == null ? 0 : typeof v === 'string' ? parseFloat(v) || 0 : v

export function VisitsTab({ patient }: { patient: Patient }) {
  const { data: history, isLoading } = usePatientHistory(patient.id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const encounters = history?.encounters ?? []

  return (
    <div className="space-y-4 mt-4 animate-in fade-in duration-300">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CalendarCheck2 className="text-brand-600" size={20} />
          Visits
        </h3>
        <p className="text-sm text-muted-foreground">
          Real visit records — created when the patient checks in for an
          appointment. {encounters.length} on record.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : encounters.length === 0 ? (
        <Card className="min-h-[200px] flex flex-col items-center justify-center p-6 border-dashed bg-muted/20 text-muted-foreground text-center">
          <CalendarCheck2 size={32} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium">No visits yet.</p>
          <p className="text-xs">
            A visit is recorded automatically when the patient checks in for an
            appointment.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {encounters.map((enc) => (
            <VisitCard
              key={enc.id}
              encounter={enc}
              onView={() => setSelectedId(enc.id)}
            />
          ))}
        </div>
      )}

      <EncounterDetailDialog
        patientId={patient.id}
        encounterId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}

function VisitCard({
  encounter,
  onView,
}: {
  encounter: Encounter
  onView: () => void
}) {
  const treatments = encounter.treatments ?? []
  const total = treatments.reduce((sum, t) => sum + num(t.cost), 0)
  const date = new Date(encounter.encounterDate)

  return (
    <Card className="flex items-stretch gap-3 p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex min-w-[58px] flex-col items-center justify-center rounded-lg bg-primary-soft px-2 py-1.5 text-center text-primary-text">
        <span className="text-[10px] font-bold uppercase leading-none opacity-70">
          {date.toLocaleDateString([], { month: 'short' })}
        </span>
        <span className="text-xl font-bold leading-tight tabular-nums">
          {date.getDate()}
        </span>
        <span className="text-[10px] leading-none opacity-70">
          {date.toLocaleDateString([], { weekday: 'short' })}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
            <ClipboardCheck size={14} className="text-brand-600" />
            {treatments.length} treatment{treatments.length === 1 ? '' : 's'}
          </span>
          {total > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              <Banknote size={11} className="mr-1" /> Rs.{' '}
              {total.toLocaleString()}
            </Badge>
          )}
        </div>
        {encounter.reason && (
          <p className="mt-1 truncate text-xs italic text-muted-foreground">
            “{encounter.reason}”
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-center">
        <Button size="sm" variant="outline" onClick={onView}>
          <Eye size={14} className="mr-1.5" /> View
        </Button>
      </div>
    </Card>
  )
}
