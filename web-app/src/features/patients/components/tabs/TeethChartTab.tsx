import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Loader2,
  Plus,
  Stethoscope,
  Clock,
  Save,
  RotateCcw,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useTeethCharts,
  useCreateTeethChart,
} from '../../hooks/usePatientSubEntities'
import { useAuthStore } from '@/store/useAuthStore'
import { useAccess } from '@/features/access/hooks/useAccess'
import type { Patient, PatientTeethChart } from '../../types'
import { formatDate } from '@/lib/datetime'

// FDI two-digit notation, arranged left→right as seen facing the patient.
const TEETH_UPPER = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
]
const TEETH_LOWER = [
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
]

const CONDITIONS: Record<string, { label: string; dot: string; chip: string }> =
  {
    HEALTHY: {
      label: 'Healthy',
      dot: 'bg-green-500',
      chip: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/40',
    },
    CARIES: {
      label: 'Caries',
      dot: 'bg-red-500',
      chip: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40',
    },
    FILLED: {
      label: 'Filled',
      dot: 'bg-blue-500',
      chip: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40',
    },
    CROWN: {
      label: 'Crown',
      dot: 'bg-purple-500',
      chip: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/40',
    },
    EXTRACTION_NEEDED: {
      label: 'Extraction',
      dot: 'bg-orange-500',
      chip: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/40',
    },
    MISSING: {
      label: 'Missing',
      dot: 'bg-muted-foreground',
      chip: 'bg-muted text-muted-foreground border-border',
    },
  }

const CONDITION_KEYS = Object.keys(CONDITIONS)

// Crown fill/stroke per condition for the anatomical tooth rendering.
const TOOTH_COLORS: Record<string, { fill: string; stroke: string }> = {
  _: { fill: '#ffffff', stroke: '#cbd5e1' },
  HEALTHY: { fill: '#dcfce7', stroke: '#16a34a' },
  CARIES: { fill: '#fee2e2', stroke: '#dc2626' },
  FILLED: { fill: '#dbeafe', stroke: '#2563eb' },
  CROWN: { fill: '#f3e8ff', stroke: '#9333ea' },
  EXTRACTION_NEEDED: { fill: '#ffedd5', stroke: '#ea580c' },
  MISSING: { fill: '#f1f5f9', stroke: '#94a3b8' },
}

type ToothKind = 'molar' | 'premolar' | 'canine' | 'incisor'

// Map an FDI number to its anatomical type by position within the quadrant.
function toothKind(fdi: number): ToothKind {
  const pos = fdi % 10 // 1=central incisor … 8=third molar
  if (pos <= 2) return 'incisor'
  if (pos === 3) return 'canine'
  if (pos <= 5) return 'premolar'
  return 'molar'
}

/**
 * Anatomical tooth drawn in "upper" orientation: root tips at the top, the
 * biting (occlusal/incisal) edge at the bottom. Lower-arch teeth flip this
 * vertically. Crown shape + root count vary by tooth kind so each is
 * recognisable; the crown is filled by the charted condition.
 */
function ToothShape({
  kind,
  fill,
  stroke,
}: {
  kind: ToothKind
  fill: string
  stroke: string
}) {
  const root = (
    cx: number,
    halfW: number,
    baseY: number,
    tipX: number,
    tipY: number,
  ) =>
    `M ${cx - halfW},${baseY} Q ${cx - halfW * 0.5},${(baseY + tipY) / 2} ${tipX},${tipY} Q ${cx + halfW * 0.5},${(baseY + tipY) / 2} ${cx + halfW},${baseY} Z`

  let roots: string[] = []
  let crown = ''
  if (kind === 'molar') {
    roots = [
      root(13, 4, 30, 9, 4),
      root(20, 4, 30, 20, 3),
      root(27, 4, 30, 31, 4),
    ]
    crown = 'M5,30 Q4,54 9,57 Q14,61 20,57 Q26,61 31,57 Q36,54 35,30 Z'
  } else if (kind === 'premolar') {
    roots = [root(15, 4, 30, 13, 5), root(25, 4, 30, 27, 5)]
    crown = 'M9,30 Q8,52 14,56 Q20,61 26,56 Q32,52 31,30 Z'
  } else if (kind === 'canine') {
    roots = [root(20, 5, 28, 20, 2)]
    crown = 'M12,28 Q11,48 20,59 Q29,48 28,28 Z'
  } else {
    roots = [root(20, 4, 30, 20, 5)]
    crown = 'M13,30 Q12,53 16,57 L24,57 Q28,53 27,30 Z'
  }

  return (
    <>
      {roots.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="#f6efe2"
          stroke={stroke}
          strokeWidth={1.1}
          opacity={0.85}
        />
      ))}
      <path
        d={crown}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </>
  )
}

// Per-tooth value: { condition, note? }. Legacy charts stored a bare condition
// string, so normalise on read to stay backward compatible.
type ToothEntry = { condition: string; note?: string }
const normalize = (v: unknown): ToothEntry =>
  typeof v === 'string' ? { condition: v } : (v as ToothEntry)

function asEntries(
  chartData: Record<string, unknown> | null | undefined,
): Record<string, ToothEntry> {
  const out: Record<string, ToothEntry> = {}
  for (const [k, v] of Object.entries(chartData || {})) out[k] = normalize(v)
  return out
}

export function TeethChartTab({ patient }: { patient: Patient }) {
  const { data: charts = [], isLoading } = useTeethCharts(patient.id)
  const [isAdding, setIsAdding] = useState(false)
  const [viewing, setViewing] = useState<PatientTeethChart | null>(null)
  const canEdit = useAccess().can('patients.chart.edit')

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-4 animate-in fade-in duration-300">
      <div className="xl:col-span-2 space-y-4">
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
            onCancel={() => setIsAdding(false)}
            onSuccess={() => setIsAdding(false)}
          />
        ) : viewing ? (
          <ChartViewer chart={viewing} onClose={() => setViewing(null)} />
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
      <div className="space-y-4">
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
            {charts.map((chart) => {
              const marked = Object.keys(chart.chartData || {}).length
              return (
                <Card
                  key={chart.id}
                  onClick={() => {
                    setIsAdding(false)
                    setViewing(chart)
                  }}
                  className={`text-sm cursor-pointer transition-colors shadow-sm hover:border-brand-300 ${
                    viewing?.id === chart.id
                      ? 'border-primary/50 ring-1 ring-primary/30'
                      : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-primary-text">
                        {formatDate(chart.recordedAt)}
                      </span>
                      {chart.isInitialChart && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 px-1.5"
                        >
                          INITIAL
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-1">
                      {marked} {marked === 1 ? 'tooth' : 'teeth'} charted
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
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function NewChartForm({
  patientId,
  onCancel,
  onSuccess,
}: {
  patientId: string
  onCancel: () => void
  onSuccess: () => void
}) {
  const { mutate, isPending } = useCreateTeethChart()
  const [chartData, setChartData] = useState<Record<string, ToothEntry>>({})
  const [notes, setNotes] = useState('')
  const [activeCondition, setActiveCondition] = useState<string>('HEALTHY')
  const { user } = useAuthStore()

  const markedKeys = Object.keys(chartData)
  const markedCount = markedKeys.length

  const handleToothClick = (toothId: number) => {
    const key = toothId.toString()
    setChartData((prev) => {
      // Click again with the same condition → unset the tooth.
      if (prev[key]?.condition === activeCondition) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return {
        ...prev,
        [key]: { condition: activeCondition, note: prev[key]?.note },
      }
    })
  }

  const setToothNote = (key: string, note: string) =>
    setChartData((prev) => ({
      ...prev,
      [key]: { ...prev[key], note },
    }))

  const handleSubmit = () => {
    if (!user?.uuid) {
      toast.error('Your session is missing — please sign in again.')
      return
    }
    if (markedCount === 0 && !notes.trim()) {
      toast.error('Mark at least one tooth or add a note before saving.')
      return
    }
    // Drop empty notes so the stored JSON stays clean.
    const cleaned: Record<string, ToothEntry> = {}
    for (const [k, v] of Object.entries(chartData)) {
      cleaned[k] = v.note?.trim()
        ? { condition: v.condition, note: v.note.trim() }
        : { condition: v.condition }
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

  return (
    <Card className="border-primary/20 shadow-md ring-1 ring-primary/10">
      <CardHeader className="bg-muted/30 pb-4 border-b">
        <CardTitle className="text-md">Interactive FDI Chart</CardTitle>
        <CardDescription>
          Pick a condition, then click teeth to mark them. Click a marked tooth
          again to clear it. Add a per-tooth note below.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Condition toolbar */}
        <div className="flex flex-wrap gap-2 justify-center p-3 rounded-lg bg-muted/30 border">
          {CONDITION_KEYS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCondition(c)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                activeCondition === c
                  ? 'ring-2 ring-primary ring-offset-1 ring-offset-background ' +
                    CONDITIONS[c].chip
                  : 'bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${CONDITIONS[c].dot}`}
              />
              {CONDITIONS[c].label}
            </button>
          ))}
        </div>

        {/* Teeth grid */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="flex w-full items-center justify-between px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Upper Right</span>
            <span>Upper Left</span>
          </div>
          <div className="flex flex-nowrap justify-center gap-0.5 overflow-x-auto">
            {TEETH_UPPER.map((t) => (
              <Tooth
                key={t}
                id={t}
                entry={chartData[t.toString()]}
                onClick={() => handleToothClick(t)}
                isUpper
              />
            ))}
          </div>
          <div className="h-px w-3/4 bg-border my-1" />
          <div className="flex flex-nowrap justify-center gap-0.5 overflow-x-auto">
            {TEETH_LOWER.map((t) => (
              <Tooth
                key={t}
                id={t}
                entry={chartData[t.toString()]}
                onClick={() => handleToothClick(t)}
                isUpper={false}
              />
            ))}
          </div>
          <div className="flex w-full items-center justify-between px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Lower Right</span>
            <span>Lower Left</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {markedCount} {markedCount === 1 ? 'tooth' : 'teeth'} marked
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setChartData({})}
            disabled={markedCount === 0}
          >
            <RotateCcw size={14} className="mr-1.5" /> Clear all
          </Button>
        </div>

        {/* Per-tooth notes */}
        {markedCount > 0 && (
          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Per-tooth notes
            </p>
            <div className="space-y-2">
              {markedKeys
                .sort((a, b) => Number(a) - Number(b))
                .map((key) => {
                  const entry = chartData[key]
                  const cfg = CONDITIONS[entry.condition]
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span
                        className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-sm border text-[11px] font-bold ${
                          cfg?.chip ?? ''
                        }`}
                        title={cfg?.label}
                      >
                        {key}
                      </span>
                      <Input
                        value={entry.note ?? ''}
                        onChange={(e) => setToothNote(key, e.target.value)}
                        placeholder={`Note for tooth ${key} (${cfg?.label ?? ''})`}
                        className="h-8 text-xs"
                      />
                    </div>
                  )
                })}
            </div>
          </div>
        )}

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
          <Button variant="ghost" onClick={onCancel} disabled={isPending}>
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
    </Card>
  )
}

function ChartViewer({
  chart,
  onClose,
}: {
  chart: PatientTeethChart
  onClose: () => void
}) {
  const data = asEntries(chart.chartData)
  const noted = Object.entries(data)
    .filter(([, v]) => v.note)
    .sort(([a], [b]) => Number(a) - Number(b))

  // Legend of conditions actually present in this snapshot.
  const present = Array.from(
    new Set(Object.values(data).map((v) => v.condition)),
  ).filter((c) => CONDITIONS[c])

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
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-nowrap justify-center gap-0.5 overflow-x-auto">
            {TEETH_UPPER.map((t) => (
              <Tooth
                key={t}
                id={t}
                entry={data[t.toString()]}
                readOnly
                isUpper
              />
            ))}
          </div>
          <div className="h-px w-3/4 bg-border my-1" />
          <div className="flex flex-nowrap justify-center gap-0.5 overflow-x-auto">
            {TEETH_LOWER.map((t) => (
              <Tooth
                key={t}
                id={t}
                entry={data[t.toString()]}
                readOnly
                isUpper={false}
              />
            ))}
          </div>
        </div>

        {present.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {present.map((c) => (
              <span
                key={c}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${CONDITIONS[c].chip}`}
              >
                <span className={`h-2 w-2 rounded-full ${CONDITIONS[c].dot}`} />
                {CONDITIONS[c].label}
              </span>
            ))}
          </div>
        )}

        {noted.length > 0 && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">
              Per-tooth notes
            </p>
            <ul className="space-y-1 text-sm">
              {noted.map(([key, v]) => (
                <li key={key} className="flex gap-2">
                  <Badge variant="outline" className="h-5 shrink-0">
                    {key}
                  </Badge>
                  <span className="text-muted-foreground">{v.note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {chart.notes && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              Notes
            </p>
            <p className="text-sm whitespace-pre-wrap">{chart.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Tooth({
  id,
  entry,
  onClick,
  readOnly,
  isUpper,
}: {
  id: number
  entry?: ToothEntry
  onClick?: () => void
  readOnly?: boolean
  isUpper?: boolean
}) {
  const condition = entry?.condition
  const cfg = condition ? CONDITIONS[condition] : null
  const colors = TOOTH_COLORS[condition ?? '_'] ?? TOOTH_COLORS._
  const kind = toothKind(id)
  const missing = condition === 'MISSING'
  const hasNote = !!entry?.note

  const numberLabel = (
    <span className="text-[9px] font-semibold leading-none text-muted-foreground tabular-nums">
      {id}
    </span>
  )

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={readOnly}
      title={
        cfg
          ? `${id} (${kind}) — ${cfg.label}${entry?.note ? `: ${entry.note}` : ''}`
          : `${id} — ${kind}`
      }
      className={`group relative flex flex-col items-center gap-0.5 rounded-md px-0.5 py-1 transition-colors ${
        readOnly ? 'cursor-default' : 'hover:bg-muted/60'
      } ${cfg && !readOnly ? 'ring-1 ring-inset ring-border' : ''}`}
    >
      {isUpper && numberLabel}
      <svg
        viewBox="0 0 40 62"
        width="26"
        height="40"
        className={missing ? 'opacity-40' : ''}
        style={{ transform: isUpper ? undefined : 'scaleY(-1)' }}
      >
        <ToothShape kind={kind} fill={colors.fill} stroke={colors.stroke} />
        {missing && (
          <line
            x1="9"
            y1="52"
            x2="31"
            y2="12"
            stroke="#94a3b8"
            strokeWidth="2.5"
          />
        )}
      </svg>
      {!isUpper && numberLabel}
      {hasNote && (
        <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-brand-600 ring-1 ring-background" />
      )}
    </button>
  )
}
