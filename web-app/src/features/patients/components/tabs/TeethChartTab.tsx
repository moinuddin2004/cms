import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  ClipboardList,
  Loader2,
  Plus,
  Stethoscope,
  Clock,
  Save,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  useTeethCharts,
  useCreateTeethChart,
} from '../../hooks/usePatientSubEntities'
import { useAuthStore } from '@/store/useAuthStore'
import { useAccess } from '@/features/access/hooks/useAccess'
import { TreatmentPlanSheet } from '@/features/treatment-plans'
import type { TreatmentPlanPrefill } from '@/features/treatment-plans'
import type { Patient, PatientTeethChart } from '../../types'
import { formatDate } from '@/lib/datetime'
import {
  CONDITIONS,
  applyCondition,
  chartStats,
  chartedTeeth,
  clearTooth,
  cycleSurface,
  dentitionOf,
  entryOf,
  findingLabel,
  normalizeChart,
  plannedWork,
  removeFinding,
  serializeChart,
  setToothNote,
  toggleFindingPlanned,
} from '../../utils/teethChart'
import type { ChartData, Dentition } from '../../utils/teethChart'
import { ArchOdontogram, describeHover } from '../teeth-chart/ArchOdontogram'
import type { ChartHover } from '../teeth-chart/ArchOdontogram'
import { ChartToolbar, toolHint } from '../teeth-chart/ChartToolbar'
import type { ChartTool } from '../teeth-chart/ChartToolbar'
import { ToothDetailPanel } from '../teeth-chart/ToothDetailPanel'
import { FindingsSummary } from '../teeth-chart/FindingsSummary'

export function TeethChartTab({ patient }: { patient: Patient }) {
  const { data: charts = [], isLoading } = useTeethCharts(patient.id)
  const [isAdding, setIsAdding] = useState(false)
  const [viewing, setViewing] = useState<PatientTeethChart | null>(null)
  const canEdit = useAccess().can('patients.chart.edit')

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-4 animate-in fade-in duration-300">
      {/* While charting, the chart takes the full width. */}
      <div
        className={`space-y-4 ${isAdding ? 'xl:col-span-3' : 'xl:col-span-2'}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Stethoscope className="text-primary" size={20} />
              FDI Teeth Charting
            </h3>
            <p className="text-sm text-muted-foreground">
              Medico-legal append-only charting.
            </p>
          </div>
          {!isAdding && canEdit && (
            <Button
              onClick={() => {
                setViewing(null)
                setIsAdding(true)
              }}
              size="sm"
            >
              <Plus className="mr-2" size={16} /> New Chart
            </Button>
          )}
        </div>

        {isAdding ? (
          <NewChartForm
            patientId={patient.id}
            // Start from the latest chart so the doctor only charts changes.
            baseline={charts[0]}
            onCancel={() => setIsAdding(false)}
            onSuccess={() => setIsAdding(false)}
          />
        ) : viewing ? (
          <ChartViewer
            key={viewing.id}
            chart={viewing}
            patientId={patient.id}
            onClose={() => setViewing(null)}
          />
        ) : (
          <Card className="min-h-[400px] flex flex-col items-center justify-center p-6 border-dashed bg-muted/20 text-muted-foreground text-center">
            <Stethoscope size={32} className="opacity-20 mb-3" />
            <p className="mb-2 font-medium">
              Click "New Chart" to record the current state.
            </p>
            <p className="text-xs max-w-sm">
              Teeth charts are immutable. Saving a new chart creates an
              append-only snapshot of the patient's dental health at this exact
              moment.
            </p>
          </Card>
        )}
      </div>

      {/* History sidebar */}
      <div className={`space-y-4 ${isAdding ? 'hidden' : ''}`}>
        <h4 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider">
          <Clock size={16} /> Chart History
        </h4>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : charts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic bg-muted/30 p-4 rounded-lg border">
            No previous charting history found.
          </p>
        ) : (
          <div className="space-y-3">
            {charts.map((chart) => (
              <HistoryCard
                key={chart.id}
                chart={chart}
                active={viewing?.id === chart.id}
                onOpen={() => {
                  setIsAdding(false)
                  setViewing(chart)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryCard({
  chart,
  active,
  onOpen,
}: {
  chart: PatientTeethChart
  active: boolean
  onOpen: () => void
}) {
  const stats = useMemo(
    () => chartStats(normalizeChart(chart.chartData)),
    [chart.chartData],
  )
  return (
    <Card
      onClick={onOpen}
      className={`text-sm cursor-pointer transition-colors shadow-sm hover:border-brand-300 ${
        active ? 'border-primary/50 ring-1 ring-primary/30' : ''
      }`}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-1">
          <span className="font-semibold text-primary-text">
            {formatDate(chart.recordedAt)}
          </span>
          {chart.isInitialChart && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              INITIAL
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mb-1">
          {stats.teeth} {stats.teeth === 1 ? 'tooth' : 'teeth'} charted
          {stats.planned > 0 && (
            <span className="text-amber-700 dark:text-amber-400">
              {' '}
              · {stats.planned} planned
            </span>
          )}
        </p>
        <p className="text-muted-foreground text-xs line-clamp-2">
          {chart.notes || 'No notes provided.'}
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-primary">
          <Eye size={12} /> View
        </span>
      </CardContent>
    </Card>
  )
}

/** Show the arch the chart is mostly about (a child's chart → primary). */
function initialDentition(data: ChartData): Dentition {
  const teeth = chartedTeeth(data)
  if (teeth.length === 0) return 'permanent'
  const primary = teeth.filter((t) => dentitionOf(t) === 'primary').length
  return primary > teeth.length - primary ? 'primary' : 'permanent'
}

function countOn(data: ChartData, dentition: Dentition) {
  return chartedTeeth(data).filter((t) => dentitionOf(t) === dentition).length
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-slate-400" /> Solid = existing
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-[repeating-linear-gradient(45deg,var(--color-slate-400)_0_2px,transparent_2px_4px)]" />
        Striped = planned
      </span>
      <span>M mesial · D distal · B buccal · L lingual · O/I occlusal</span>
    </div>
  )
}

type History = { data: ChartData; past: ChartData[] }
type HistoryAction =
  | { type: 'edit'; fn: (d: ChartData) => ChartData; undoable?: boolean }
  | { type: 'undo' }

/** Chart edits with an undo stack (typing a note isn't undoable). */
function historyReducer(s: History, a: HistoryAction): History {
  if (a.type === 'undo')
    return s.past.length
      ? { data: s.past[s.past.length - 1], past: s.past.slice(0, -1) }
      : s
  const next = a.fn(s.data)
  if (next === s.data) return s
  return a.undoable === false
    ? { ...s, data: next }
    : { data: next, past: [...s.past.slice(-49), s.data] }
}

function NewChartForm({
  patientId,
  baseline,
  onCancel,
  onSuccess,
}: {
  patientId: string
  baseline?: PatientTeethChart
  onCancel: () => void
  onSuccess: () => void
}) {
  const { mutate, isPending } = useCreateTeethChart()
  const { user } = useAuthStore()
  const initial = useMemo(() => normalizeChart(baseline?.chartData), [baseline])
  const [{ data, past }, dispatch] = useReducer(
    historyReducer,
    initial,
    (d): History => ({ data: d, past: [] }),
  )
  const [notes, setNotes] = useState('')
  const [tool, setTool] = useState<ChartTool>('SELECT')
  const [planned, setPlanned] = useState(false)
  const [dentition, setDentition] = useState<Dentition>(() =>
    initialDentition(initial),
  )
  const [selected, setSelected] = useState<number | null>(null)
  const [hover, setHover] = useState<ChartHover>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const dirty = data !== initial || notes.trim() !== ''

  const edit = (fn: (d: ChartData) => ChartData) =>
    dispatch({ type: 'edit', fn })
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, [contenteditable="true"]')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (e.key === 'Escape') setTool('SELECT')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  const onSurfaceClick = (
    tooth: number,
    surface: Parameters<typeof applyCondition>[4] | null,
  ) => {
    if (tool === 'SELECT') return
    if (CONDITIONS[tool].scope === 'surface' && !surface) return
    edit((d) => applyCondition(d, tooth, tool, planned, surface ?? undefined))
  }

  const selectTooth = (t: number) => {
    setSelected(t)
    if (dentitionOf(t) !== dentition) setDentition(dentitionOf(t))
  }

  const handleSubmit = () => {
    if (!user?.uuid) {
      toast.error('Your session is missing — please sign in again.')
      return
    }
    const cleaned = serializeChart(data)
    if (Object.keys(cleaned).length === 0 && !notes.trim()) {
      toast.error('Mark at least one tooth or add a note before saving.')
      return
    }
    mutate(
      {
        patientId,
        chartData: cleaned,
        notes: notes.trim() || undefined,
        dentistId: user.uuid,
      },
      { onSuccess },
    )
  }

  const entry = selected !== null ? entryOf(data, selected) : undefined
  const hint = describeHover(hover, data) ?? toolHint(tool)

  return (
    <Card className="border-primary/20 shadow-md ring-1 ring-primary/10">
      <CardHeader className="bg-muted/30 pb-4 border-b">
        <CardTitle className="text-md">New dental chart</CardTitle>
        <CardDescription>
          {baseline
            ? `Started from the chart of ${formatDate(baseline.recordedAt)} — update what changed.`
            : 'Pick a condition and click the tooth surfaces, or select a tooth and chart it in the side panel.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        <ChartToolbar
          tool={tool}
          onTool={setTool}
          planned={planned}
          onPlanned={setPlanned}
          dentition={dentition}
          onDentition={setDentition}
          otherDentitionCount={countOn(
            data,
            dentition === 'permanent' ? 'primary' : 'permanent',
          )}
          canUndo={past.length > 0}
          onUndo={undo}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <ArchOdontogram
              dentition={dentition}
              data={data}
              selected={selected}
              onSelect={selectTooth}
              onSurfaceClick={onSurfaceClick}
              onHover={setHover}
            />
            <p
              className="mt-1 min-h-5 text-center text-xs text-muted-foreground"
              aria-live="polite"
            >
              {hint}
            </p>
          </div>
          <ToothDetailPanel
            tooth={selected}
            entry={entry}
            onCycleSurface={(s) =>
              selected !== null &&
              edit((d) => cycleSurface(d, selected, s, planned))
            }
            onApply={(c) =>
              selected !== null &&
              edit((d) => applyCondition(d, selected, c, planned))
            }
            onRemove={(f) =>
              selected !== null && edit((d) => removeFinding(d, selected, f))
            }
            onTogglePlanned={(f) =>
              selected !== null &&
              edit((d) => toggleFindingPlanned(d, selected, f))
            }
            onNote={(note) =>
              selected !== null &&
              dispatch({
                type: 'edit',
                fn: (d) => setToothNote(d, selected, note),
                undoable: false,
              })
            }
            onClear={() =>
              selected !== null && edit((d) => clearTooth(d, selected))
            }
          />
        </div>

        <Legend />

        <div className="rounded-lg border p-3">
          <FindingsSummary
            data={data}
            selected={selected}
            onSelect={selectTooth}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Clinical Notes
          </label>
          <Textarea
            placeholder="Record detailed observations here before saving..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="resize-none h-24"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            variant="ghost"
            onClick={() => (dirty ? setConfirmDiscard(true) : onCancel())}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Immutable Snapshot
          </Button>
        </div>
      </CardContent>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this chart?"
        description="The teeth you marked and your notes haven't been saved and will be lost."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false)
          onCancel()
        }}
      />
    </Card>
  )
}

function ChartViewer({
  chart,
  patientId,
  onClose,
}: {
  chart: PatientTeethChart
  patientId: string
  onClose: () => void
}) {
  const data = useMemo(() => normalizeChart(chart.chartData), [chart])
  const [dentition, setDentition] = useState<Dentition>(() =>
    initialDentition(data),
  )
  const [selected, setSelected] = useState<number | null>(null)
  const [hover, setHover] = useState<ChartHover>(null)
  const [planSheet, setPlanSheet] = useState(false)
  const canPlan = useAccess().can('plans.manage')
  const work = useMemo(() => plannedWork(data), [data])

  const prefill = useMemo<TreatmentPlanPrefill>(
    () => ({
      teeth: work.map((w) => String(w.tooth)),
      notes: [
        `From the dental chart of ${formatDate(chart.recordedAt)}:`,
        ...work.map(
          (w) => `${w.tooth}: ${w.findings.map(findingLabel).join(', ')}`,
        ),
      ].join('\n'),
    }),
    [work, chart.recordedAt],
  )

  const selectTooth = (t: number) => {
    setSelected(t)
    if (dentitionOf(t) !== dentition) setDentition(dentitionOf(t))
  }

  const other = dentition === 'permanent' ? 'primary' : 'permanent'
  const otherCount = countOn(data, other)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-md">
            Chart — {formatDate(chart.recordedAt)}
          </CardTitle>
          <CardDescription>Read-only snapshot.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {(otherCount > 0 || dentition === 'primary') && (
          <div className="flex flex-wrap gap-1.5">
            {(['permanent', 'primary'] as const).map((d) => (
              <Button
                key={d}
                type="button"
                size="sm"
                variant={d === dentition ? 'secondary' : 'ghost'}
                className="h-7 text-xs"
                onClick={() => setDentition(d)}
              >
                {d === 'permanent' ? 'Permanent' : 'Primary (child)'}
                {d !== dentition && otherCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                    {otherCount}
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <ArchOdontogram
              dentition={dentition}
              data={data}
              selected={selected}
              onSelect={selectTooth}
              onHover={setHover}
            />
            <p className="mt-1 min-h-5 text-center text-xs text-muted-foreground">
              {describeHover(hover, data) ??
                'Hover or click a tooth for details'}
            </p>
          </div>
          <ToothDetailPanel
            tooth={selected}
            entry={selected !== null ? entryOf(data, selected) : undefined}
            readOnly
          />
        </div>

        <Legend />

        <div className="rounded-lg border p-3">
          <FindingsSummary
            data={data}
            selected={selected}
            onSelect={selectTooth}
            action={
              canPlan &&
              work.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPlanSheet(true)}
                >
                  <ClipboardList className="size-4" />
                  Create treatment plan
                </Button>
              )
            }
          />
        </div>

        {chart.notes && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              Notes
            </p>
            <p className="text-sm whitespace-pre-wrap">{chart.notes}</p>
          </div>
        )}
      </CardContent>

      {planSheet && (
        <TreatmentPlanSheet
          open
          onOpenChange={(o) => !o && setPlanSheet(false)}
          patientId={patientId}
          dentistId={chart.dentistId}
          plan={null}
          prefill={prefill}
        />
      )}
    </Card>
  )
}
