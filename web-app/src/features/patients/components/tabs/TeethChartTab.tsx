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
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, Stethoscope, Clock, Save } from 'lucide-react'
import {
  useTeethCharts,
  useCreateTeethChart,
} from '../../hooks/usePatientSubEntities'
import { useAuthStore } from '@/store/useAuthStore'
import type { Patient, PatientTeethChart } from '../../types'

const TEETH_UPPER = [
  18,
  17,
  16,
  15,
  14,
  13,
  12,
  11, // Quadrant 1
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28, // Quadrant 2
]
const TEETH_LOWER = [
  48,
  47,
  46,
  45,
  44,
  43,
  42,
  41, // Quadrant 4
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38, // Quadrant 3
]

const SELECTION_COLORS: Record<string, string> = {
  HEALTHY: 'bg-green-100 text-green-700 border-green-300',
  CARIES: 'bg-red-100 text-red-700 border-red-300',
  FILLED: 'bg-blue-100 text-blue-700 border-blue-300',
  MISSING: 'bg-gray-200 text-gray-500 border-gray-400 opacity-50',
  CROWN: 'bg-purple-100 text-purple-700 border-purple-300',
  EXTRACTION_NEEDED: 'bg-orange-100 text-orange-700 border-orange-300',
}

const LEGEND = Object.keys(SELECTION_COLORS)

export function TeethChartTab({ patient }: { patient: Patient }) {
  const { data: charts = [], isLoading } = useTeethCharts(patient.id)
  const [isAdding, setIsAdding] = useState(false)

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-4 animate-in fade-in duration-300">
      {/* 2/3 width Main Content */}
      <div className="xl:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Stethoscope className="text-brand-600" size={20} />
              FDI Teeth Charting
            </h3>
            <p className="text-sm text-muted-foreground">
              Medico-legal append-only charting.
            </p>
          </div>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} size="sm">
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
        ) : (
          <Card className="min-h-[400px] flex flex-col items-center justify-center p-6 border-dashed bg-muted/20 text-muted-foreground text-center">
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

      {/* 1/3 width Sidebar - History */}
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
            {charts.map((chart) => (
              <Card
                key={chart.id}
                className="text-sm hover:border-brand-300 cursor-pointer transition-colors shadow-sm"
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-brand-700">
                      {new Date(chart.recordedAt).toLocaleDateString()}
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
                  <p className="text-muted-foreground text-xs line-clamp-2 mt-1">
                    {chart.notes || 'No notes provided.'}
                  </p>
                </CardContent>
              </Card>
            ))}
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
  const [chartData, setChartData] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [activeCondition, setActiveCondition] = useState<string>('HEALTHY')

  const { user } = useAuthStore()

  const handleToothClick = (toothId: number) => {
    setChartData((prev) => ({
      ...prev,
      [toothId.toString()]: activeCondition,
    }))
  }

  const handleSubmit = () => {
    if (!user?.uuid) return
    mutate(
      {
        patientId,
        chartData,
        notes,
        isInitialChart: false, // Could be derived based on if it's the first chart
        locationId: user.activeLocationId || 'default',
        dentistId: user.uuid,
      },
      {
        onSuccess,
      },
    )
  }

  return (
    <Card className="border-brand-200 shadow-md ring-1 ring-brand-100 ring-offset-2 ring-offset-background">
      <CardHeader className="bg-brand-50/50 pb-4 border-b">
        <CardTitle className="text-md">Interactive FDI Chart</CardTitle>
        <CardDescription>
          Select a condition below, then click on the teeth to mark.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Condition Toolbar */}
        <div className="flex flex-wrap gap-2 justify-center p-3 rounded-lg bg-muted/30 border">
          {LEGEND.map((condition) => (
            <button
              key={condition}
              onClick={() => setActiveCondition(condition)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-all ${
                activeCondition === condition
                  ? 'ring-2 ring-brand-500 ring-offset-1 ' +
                    SELECTION_COLORS[condition]
                  : 'bg-background hover:bg-muted text-muted-foreground shadow-sm'
              }`}
            >
              {condition.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Teeth Grid */}
        <div className="flex flex-col items-center gap-6 py-4">
          {/* Upper Teeth */}
          <div className="flex justify-center gap-1">
            {TEETH_UPPER.map((t) => (
              <Tooth
                key={t}
                id={t}
                condition={chartData[t.toString()]}
                onClick={() => handleToothClick(t)}
              />
            ))}
          </div>
          {/* Lower Teeth */}
          <div className="flex justify-center gap-1">
            {TEETH_LOWER.map((t) => (
              <Tooth
                key={t}
                id={t}
                condition={chartData[t.toString()]}
                onClick={() => handleToothClick(t)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Clinical Notes (Immutable)
          </label>
          <Textarea
            placeholder="Record detailed exact observations here before saving..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="resize-none h-24 bg-yellow-50/30"
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

function Tooth({
  id,
  condition,
  onClick,
}: {
  id: number
  condition?: string
  onClick: () => void
}) {
  const conditionClasses = condition
    ? SELECTION_COLORS[condition]
    : 'bg-background border-border hover:bg-muted/50'

  return (
    <button
      onClick={onClick}
      className={`relative w-8 h-12 flex items-center justify-center rounded-sm border shadow-sm transition-colors text-xs font-bold ${conditionClasses}`}
    >
      {id}
    </button>
  )
}
