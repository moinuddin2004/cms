import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Banknote, CalendarCheck2, ChevronRight, Loader2 } from 'lucide-react'
import { usePatientHistory } from '../../hooks/usePatientSubEntities'
import type { Patient, Encounter } from '../../types'
import { EncounterDetailDialog } from './EncounterDetailDialog'

const num = (v: number | string | null | undefined) =>
  v == null ? 0 : typeof v === 'string' ? parseFloat(v) || 0 : v

export function VisitsTab({
  patient,
  hideAmounts = false,
}: {
  patient: Patient
  /** Clinical-only view (doctor's consultation): no fees anywhere. */
  hideAmounts?: boolean
}) {
  const { data: history, isLoading } = usePatientHistory(patient.id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const encounters = history?.encounters ?? []

  return (
    <Card className="mt-4 gap-0 py-0 animate-in fade-in duration-300">
      <CardHeader className="border-b px-4 py-3 [.border-b]:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck2 size={16} className="text-brand-600" />
          Visits
          {encounters.length > 0 && (
            <Badge variant="secondary" className="text-[11px]">
              {encounters.length}
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Created automatically when the patient checks in.
        </p>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : encounters.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <CalendarCheck2 size={28} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">No visits yet.</p>
            <p className="text-xs">
              A visit is recorded when the patient checks in.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {encounters.map((enc) => (
              <VisitRow
                key={enc.id}
                encounter={enc}
                hideAmounts={hideAmounts}
                onView={() => setSelectedId(enc.id)}
              />
            ))}
          </ul>
        )}
      </CardContent>

      <EncounterDetailDialog
        patientId={patient.id}
        encounterId={selectedId}
        onClose={() => setSelectedId(null)}
        hideAmounts={hideAmounts}
      />
    </Card>
  )
}

function VisitRow({
  encounter,
  hideAmounts,
  onView,
}: {
  encounter: Encounter
  hideAmounts: boolean
  onView: () => void
}) {
  const treatments = encounter.treatments ?? []
  const total = treatments.reduce((sum, t) => sum + num(t.cost), 0)
  const date = new Date(encounter.encounterDate)
  const summary =
    encounter.diagnosis || encounter.chiefComplaint || encounter.reason

  return (
    <li className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
      <div className="flex w-11 shrink-0 flex-col items-center rounded-md bg-primary-soft py-1 text-primary-text">
        <span className="text-[9px] font-bold uppercase leading-none opacity-70">
          {date.toLocaleDateString([], { month: 'short' })}
        </span>
        <span className="text-base font-bold leading-tight tabular-nums">
          {date.getDate()}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{summary || 'Visit'}</p>
        <p className="truncate text-xs text-muted-foreground">
          {date.toLocaleDateString([], { weekday: 'short', year: 'numeric' })} ·{' '}
          {date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{' '}
          · {treatments.length} treatment{treatments.length === 1 ? '' : 's'}
          {treatments.length > 0 &&
            `: ${treatments.map((t) => t.treatmentName).join(', ')}`}
        </p>
      </div>

      {!hideAmounts && total > 0 && (
        <Badge variant="secondary" className="shrink-0 text-[11px]">
          <Banknote size={11} className="mr-1" /> Rs. {total.toLocaleString()}
        </Badge>
      )}

      <TooltipButton
        tooltip="View visit details"
        size="icon"
        variant="ghost"
        className="size-8 shrink-0"
        onClick={onView}
      >
        <ChevronRight size={16} />
      </TooltipButton>
    </li>
  )
}
