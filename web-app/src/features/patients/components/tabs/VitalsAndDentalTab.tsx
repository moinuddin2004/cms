import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useForm } from '@tanstack/react-form'
import { Loader2, Plus, Activity, Droplets } from 'lucide-react'
import { toast } from 'sonner'
import {
  useVitals,
  useDentalInfo,
  useUpsertDentalInfo,
  useCreateVitals,
} from '../../hooks/usePatientSubEntities'
import type { Patient, PatientVitals, PatientDentalInfo } from '../../types'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { GumCondition, BrushingFrequency, FlossingFrequency } from '../../types'
import { useAuthStore } from '@/store/useAuthStore'

export function VitalsAndDentalTab({ patient }: { patient: Patient }) {
  const { data: vitals = [], isLoading: loadingVitals } = useVitals(patient.id)
  const { data: dentalInfo, isLoading: loadingDental } = useDentalInfo(
    patient.id,
  )

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-4 animate-in fade-in duration-300">
      {/* Vitals Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="text-brand-600" size={20} />
            Patient Vitals History
          </h3>
        </div>

        {loadingVitals ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : vitals.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="text-center py-10 text-muted-foreground">
              <Activity size={32} className="mx-auto mb-2 opacity-30" />
              <p>No vitals recorded yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {vitals.map((vital) => (
              <VitalCard key={vital.id} vital={vital} />
            ))}
          </div>
        )}

        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-md flex items-center gap-2">
              <Plus size={16} /> Record New Vitals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VitalsForm patientId={patient.id} />
          </CardContent>
        </Card>
      </div>

      {/* Dental Info Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Droplets className="text-blue-500" size={20} />
            Dental Health & Habits
          </h3>
        </div>

        <Card>
          <CardContent className="pt-6">
            {loadingDental ? (
              <div className="flex justify-center p-8">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              // Re-key on the record id so the form re-initialises with the
              // saved values once the upsert completes.
              <DentalInfoForm
                key={dentalInfo?.id ?? 'new'}
                patientId={patient.id}
                existing={dentalInfo ?? undefined}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function VitalCard({ vital }: { vital: PatientVitals }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2 border-b pb-2">
          <span className="text-xs font-semibold text-muted-foreground">
            {new Date(vital.recordedAt).toLocaleString()}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-sm mt-3">
          <Metric label="BP" value={`${vital.bpSystolic || '-'}/${vital.bpDiastolic || '-'}`} />
          <Metric label="Pulse" value={vital.pulseRate} unit="bpm" />
          <Metric label="Temp" value={vital.temperature} unit="°C" />
          <Metric label="SpO₂" value={vital.oxygenSaturation} unit="%" />
          <Metric label="Weight" value={vital.weightKg} unit="kg" />
          <Metric label="BMI" value={vital.bmi} />
        </div>
        {vital.notes && (
          <p className="mt-3 text-xs text-muted-foreground border-t pt-2">
            {vital.notes}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string
  value: number | string | null | undefined
  unit?: string
}) {
  const display =
    value === null || value === undefined || value === '' ? '-' : value
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">
        {display}
        {display !== '-' && unit ? (
          <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  )
}

// Range guard: returns an error string or undefined. Empty is allowed (optional).
function range(min: number, max: number, label: string) {
  return ({ value }: { value: number | string | undefined }) => {
    if (value === undefined || value === '') return undefined
    const n = typeof value === 'string' ? Number(value) : value
    if (Number.isNaN(n)) return undefined
    if (n < min || n > max)
      return `${label} must be between ${min} and ${max}`
    return undefined
  }
}

function FieldError({ errors }: { errors: Array<string | undefined> }) {
  const msg = errors.find(Boolean)
  if (!msg) return null
  return <p className="text-[11px] text-destructive">{msg}</p>
}

function VitalsForm({ patientId }: { patientId: string }) {
  const { mutate, isPending } = useCreateVitals()
  const { user } = useAuthStore()

  const form = useForm({
    defaultValues: {
      bpSystolic: undefined as number | undefined,
      bpDiastolic: undefined as number | undefined,
      pulseRate: undefined as number | undefined,
      temperature: undefined as number | undefined,
      oxygenSaturation: undefined as number | undefined,
      weightKg: undefined as number | undefined,
      heightCm: undefined as number | undefined,
      notes: '' as string,
    },
    onSubmit: async ({ value }) => {
      if (!user?.uuid) {
        toast.error('Your session is missing — please sign in again.')
        return
      }
      const { notes, ...vitals } = value
      const hasAny = Object.values(vitals).some(
        (v) => v !== undefined && !Number.isNaN(v),
      )
      if (!hasAny) {
        toast.error('Enter at least one vital before saving.')
        return
      }
      mutate(
        {
          patientId,
          ...vitals,
          notes: notes.trim() || undefined,
          recordedBy: user.uuid,
        },
        { onSuccess: () => form.reset() },
      )
    },
  })

  const numField = (
    name: keyof typeof form.state.values,
    label: string,
    placeholder: string,
    validate: ReturnType<typeof range>,
  ) => (
    <form.Field name={name} validators={{ onChange: validate }}>
      {(field) => (
        <div className="space-y-1">
          <Label className="text-xs">{label}</Label>
          <Input
            type="number"
            value={field.state.value ?? ''}
            onChange={(e) =>
              field.handleChange(
                e.target.value === '' ? undefined : Number(e.target.value),
              )
            }
            onBlur={field.handleBlur}
            placeholder={placeholder}
          />
          <FieldError errors={field.state.meta.errors} />
        </div>
      )}
    </form.Field>
  )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="grid grid-cols-3 gap-3">
        {numField('bpSystolic', 'Systolic', '120', range(50, 300, 'Systolic'))}
        {numField(
          'bpDiastolic',
          'Diastolic',
          '80',
          range(30, 200, 'Diastolic'),
        )}
        {numField('pulseRate', 'Pulse (bpm)', '72', range(20, 250, 'Pulse'))}
        {numField('temperature', 'Temp (°C)', '37', range(30, 45, 'Temp'))}
        {numField('oxygenSaturation', 'SpO₂ (%)', '98', range(50, 100, 'SpO₂'))}
        {numField('weightKg', 'Weight (kg)', '70', range(1, 500, 'Weight'))}
        {numField('heightCm', 'Height (cm)', '175', range(20, 300, 'Height'))}
      </div>
      <form.Field name="notes">
        {(field) => (
          <div className="mt-3 space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Optional observations…"
            />
          </div>
        )}
      </form.Field>
      <div className="mt-3 flex justify-end">
        <form.Subscribe selector={(s) => s.isValid}>
          {(isValid) => (
            <Button type="submit" size="sm" disabled={isPending || !isValid}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Vitals
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  )
}

function DentalInfoForm({
  patientId,
  existing,
}: {
  patientId: string
  existing?: PatientDentalInfo
}) {
  const { mutate, isPending } = useUpsertDentalInfo()

  const form = useForm({
    defaultValues: {
      gumCondition: existing?.gumCondition || GumCondition.HEALTHY,
      brushingFrequency:
        existing?.brushingFrequency || BrushingFrequency.UNKNOWN,
      flossingFrequency:
        existing?.flossingFrequency || FlossingFrequency.UNKNOWN,
      teethSensitivity: existing?.teethSensitivity ?? false,
      sensitivityNotes: existing?.sensitivityNotes || '',
      smokingStatus: existing?.smokingStatus ?? false,
      tobaccoChewing: existing?.tobaccoChewing ?? false,
      orthodonticHistory: existing?.orthodonticHistory ?? false,
      orthodonticNotes: existing?.orthodonticNotes || '',
      teethConditionNotes: existing?.teethConditionNotes || '',
      previousExtractions: existing?.previousExtractions || '',
      previousSurgeries: existing?.previousSurgeries || '',
      dentistNotes: existing?.dentistNotes || '',
    },
    onSubmit: async ({ value }) => {
      mutate({ patientId, ...value })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <form.Field name="gumCondition">
            {(field) => (
              <div className="space-y-1">
                <Label className="text-xs">Gum Condition</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as GumCondition)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(GumCondition).map((v) => (
                      <SelectItem key={v} value={v} className="capitalize">
                        {v.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <form.Field name="brushingFrequency">
            {(field) => (
              <div className="space-y-1">
                <Label className="text-xs">Brushing Frequency</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) =>
                    field.handleChange(v as BrushingFrequency)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(BrushingFrequency).map((v) => (
                      <SelectItem key={v} value={v} className="capitalize">
                        {v.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <form.Field name="flossingFrequency">
            {(field) => (
              <div className="space-y-1">
                <Label className="text-xs">Flossing Frequency</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) =>
                    field.handleChange(v as FlossingFrequency)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(FlossingFrequency).map((v) => (
                      <SelectItem key={v} value={v} className="capitalize">
                        {v.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <form.Field name="teethSensitivity">
            {(field) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="teethSensitivity"
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(!!v)}
                />
                <Label
                  htmlFor="teethSensitivity"
                  className="text-xs cursor-pointer"
                >
                  Teeth Sensitivity
                </Label>
              </div>
            )}
          </form.Field>
          <form.Field name="smokingStatus">
            {(field) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="smokingStatus"
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(!!v)}
                />
                <Label htmlFor="smokingStatus" className="text-xs cursor-pointer">
                  Smoker
                </Label>
              </div>
            )}
          </form.Field>
          <form.Field name="tobaccoChewing">
            {(field) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="tobaccoChewing"
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(!!v)}
                />
                <Label
                  htmlFor="tobaccoChewing"
                  className="text-xs cursor-pointer"
                >
                  Tobacco Chewing
                </Label>
              </div>
            )}
          </form.Field>
          <form.Field name="orthodonticHistory">
            {(field) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="orthodonticHistory"
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(!!v)}
                />
                <Label
                  htmlFor="orthodonticHistory"
                  className="text-xs cursor-pointer"
                >
                  Orthodontic History
                </Label>
              </div>
            )}
          </form.Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <form.Field name="teethConditionNotes">
            {(field) => (
              <div className="space-y-1">
                <Label className="text-xs">Teeth Condition Notes</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="General teeth condition..."
                  className="resize-none h-20"
                />
              </div>
            )}
          </form.Field>
          <form.Field name="previousExtractions">
            {(field) => (
              <div className="space-y-1">
                <Label className="text-xs">Previous Extractions</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="List previous extractions..."
                  className="resize-none h-20"
                />
              </div>
            )}
          </form.Field>
          <form.Field name="previousSurgeries">
            {(field) => (
              <div className="space-y-1">
                <Label className="text-xs">Previous Surgeries</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Any previous dental surgeries..."
                  className="resize-none h-20"
                />
              </div>
            )}
          </form.Field>
          <form.Field name="dentistNotes">
            {(field) => (
              <div className="space-y-1">
                <Label className="text-xs">Dentist Notes</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Additional dentist observations..."
                  className="resize-none h-20"
                />
              </div>
            )}
          </form.Field>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existing ? 'Update Dental Info' : 'Save Dental Info'}
          </Button>
        </div>
      </div>
    </form>
  )
}
