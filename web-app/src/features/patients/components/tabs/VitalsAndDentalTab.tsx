import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Cigarette,
  Droplets,
  HeartPulse,
  Pencil,
  Plus,
  Ruler,
  Scale,
  Smile,
  Sparkles,
  Thermometer,
  Wind,
} from 'lucide-react'
import { useStore } from '@tanstack/react-form'
import type { ColumnDef } from '@/components/shared/table-features'
import {
  DataTable,
  EmptyState,
  ErrorState,
  FormSheet,
  LoadingSkeleton,
} from '@/components/shared'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { fieldError } from '@/components/forms/fieldError'
import { NumberInput } from '@/components/forms/NumberInput'
import { cn } from '@/lib/utils'
import { useAccess } from '@/features/access/hooks/useAccess'
import { useVitals, useDentalInfo } from '../../hooks/usePatientSubEntities'
import { useVitalsForm } from '../../hooks/useVitalsForm'
import { useDentalInfoForm } from '../../hooks/useDentalInfoForm'
import type { VitalKey } from '../../schemas/patient-records.schema'
import type { Patient, PatientVitals, PatientDentalInfo } from '../../types'
import { GumCondition, BrushingFrequency, FlossingFrequency } from '../../types'
import { CHIP_TONES, Chip } from './history/HistoryParts'

type Tone = 'ok' | 'warning' | 'danger'

const TONE_TEXT: Record<Tone, string> = {
  ok: 'text-foreground',
  warning: 'text-amber',
  danger: 'text-danger',
}

const has = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined

// Rough adult reference ranges — a nudge for the eye, not a diagnosis.
function bpTone(v: PatientVitals): Tone {
  const s = v.bpSystolic ?? 0
  const d = v.bpDiastolic ?? 0
  if (s >= 140 || d >= 90) return 'danger'
  if (s >= 130 || d >= 85 || (s > 0 && s < 90)) return 'warning'
  return 'ok'
}
const pulseTone = (p: number): Tone => (p < 60 || p > 100 ? 'warning' : 'ok')
const tempTone = (t: number): Tone =>
  t >= 38 ? 'danger' : t >= 37.5 || t < 35.5 ? 'warning' : 'ok'
const spo2Tone = (o: number): Tone =>
  o < 92 ? 'danger' : o < 95 ? 'warning' : 'ok'
const bmiTone = (b: number): Tone =>
  b >= 30 ? 'danger' : b >= 25 || b < 18.5 ? 'warning' : 'ok'

const TONE_LABEL: Record<Tone, string> = {
  ok: 'Normal',
  warning: 'Watch',
  danger: 'High',
}

const label = (v: string) => v.replaceAll('_', ' ')

export function VitalsAndDentalTab({ patient }: { patient: Patient }) {
  const canEdit = useAccess().can('patients.clinical.edit')
  return (
    <div className="@container mt-4 space-y-6 animate-in fade-in duration-300">
      <VitalsSection patientId={patient.id} canEdit={canEdit} />
      <DentalSection patientId={patient.id} canEdit={canEdit} />
    </div>
  )
}

// ─── Section shell ────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="text-primary" size={20} />
          {title}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

// ─── Vitals ───────────────────────────────────────────────────────────
function VitalsSection({
  patientId,
  canEdit,
}: {
  patientId: string
  canEdit: boolean
}) {
  const q = useVitals(patientId)
  const vitals = q.data ?? []
  const latest = vitals.at(0)
  const [recordOpen, setRecordOpen] = useState(false)

  const columns = useMemo<ColumnDef<PatientVitals, unknown>[]>(
    () => [
      {
        id: 'recordedAt',
        header: 'Recorded',
        accessorFn: (v) => new Date(v.recordedAt).getTime(),
        cell: ({ row }) => {
          const d = new Date(row.original.recordedAt)
          return (
            <div className="whitespace-nowrap">
              <p className="text-sm font-medium">
                {d.toLocaleDateString([], { dateStyle: 'medium' })}
              </p>
              <p className="text-xs text-muted-foreground">
                {d.toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )
        },
      },
      {
        id: 'bp',
        header: 'BP',
        enableSorting: false,
        cell: ({ row }) => {
          const v = row.original
          if (!has(v.bpSystolic) && !has(v.bpDiastolic)) return <Dash />
          return (
            <Val tone={bpTone(v)}>
              {v.bpSystolic ?? '–'}/{v.bpDiastolic ?? '–'}
            </Val>
          )
        },
      },
      numCol('pulseRate', 'Pulse', 'bpm', pulseTone),
      numCol('temperature', 'Temp', '°C', tempTone),
      numCol('oxygenSaturation', 'SpO₂', '%', spo2Tone),
      numCol('weightKg', 'Weight', 'kg'),
      numCol('bmi', 'BMI', '', bmiTone),
      {
        id: 'notes',
        header: 'Notes',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex max-w-[240px] flex-wrap items-center gap-1">
            <ConditionChips vital={row.original} />
            {row.original.notes && (
              <span
                className="truncate text-xs text-text-2"
                title={row.original.notes}
              >
                {row.original.notes}
              </span>
            )}
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={Activity}
        title="Vitals"
        subtitle={
          latest
            ? `Last recorded ${new Date(latest.recordedAt).toLocaleString([], {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}`
            : 'Blood pressure, pulse, temperature and more.'
        }
        action={
          canEdit && (
            <Button size="sm" onClick={() => setRecordOpen(true)}>
              <Plus className="size-3.5" /> Record vitals
            </Button>
          )
        }
      />

      {q.isLoading ? (
        <LoadingSkeleton variant="stats" />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !latest ? (
        <EmptyState
          icon={Activity}
          title="No vitals recorded yet"
          description="Record BP, pulse, temperature and weight to track them over time."
          action={
            canEdit && (
              <Button size="sm" onClick={() => setRecordOpen(true)}>
                <Plus className="size-3.5" /> Record vitals
              </Button>
            )
          }
        />
      ) : (
        <>
          <LatestVitals vital={latest} />
          {vitals.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                History{' '}
                <span className="ml-1 rounded-full bg-panel-2 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {vitals.length}
                </span>
              </p>
              <DataTable
                columns={columns}
                data={vitals}
                defaultPageSize={5}
                pageSizeOptions={[5, 10, 25]}
              />
            </div>
          )}
        </>
      )}

      {canEdit && (
        <RecordVitalsSheet
          patientId={patientId}
          open={recordOpen}
          onOpenChange={setRecordOpen}
        />
      )}
    </section>
  )
}

function numCol(
  key: 'pulseRate' | 'temperature' | 'oxygenSaturation' | 'weightKg' | 'bmi',
  header: string,
  unit: string,
  tone?: (n: number) => Tone,
): ColumnDef<PatientVitals, unknown> {
  return {
    id: key,
    header,
    accessorFn: (v) => v[key] ?? -1,
    cell: ({ row }) => {
      const n = row.original[key]
      if (!has(n)) return <Dash />
      return (
        <Val tone={tone ? tone(Number(n)) : 'ok'}>
          {n}
          {unit && (
            <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
              {unit}
            </span>
          )}
        </Val>
      )
    },
  }
}

function Val({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn('font-semibold tabular-nums', TONE_TEXT[tone])}>
      {children}
    </span>
  )
}

const Dash = () => <span className="text-muted-foreground">—</span>

function ConditionChips({ vital }: { vital: PatientVitals }) {
  const flags = [
    vital.isDiabetic && 'Diabetic',
    vital.isHypertensive && 'Hypertensive',
    vital.isPregnant && 'Pregnant',
    vital.isOnBloodThinners && 'Blood thinners',
    vital.isOnAntibiotics && 'On antibiotics',
  ].filter(Boolean) as string[]
  return (
    <>
      {flags.map((f) => (
        <Chip key={f} className={CHIP_TONES.warning}>
          {f}
        </Chip>
      ))}
    </>
  )
}

function LatestVitals({ vital }: { vital: PatientVitals }) {
  const tiles: {
    label: string
    icon: LucideIcon
    value: ReactNode
    unit?: string
    tone?: Tone
  }[] = [
    {
      label: 'Blood pressure',
      icon: HeartPulse,
      value:
        has(vital.bpSystolic) || has(vital.bpDiastolic)
          ? `${vital.bpSystolic ?? '–'}/${vital.bpDiastolic ?? '–'}`
          : null,
      unit: 'mmHg',
      tone: bpTone(vital),
    },
    {
      label: 'Pulse',
      icon: Activity,
      value: vital.pulseRate,
      unit: 'bpm',
      tone: has(vital.pulseRate) ? pulseTone(vital.pulseRate) : undefined,
    },
    {
      label: 'Temperature',
      icon: Thermometer,
      value: vital.temperature,
      unit: '°C',
      tone: has(vital.temperature)
        ? tempTone(Number(vital.temperature))
        : undefined,
    },
    {
      label: 'SpO₂',
      icon: Wind,
      value: vital.oxygenSaturation,
      unit: '%',
      tone: has(vital.oxygenSaturation)
        ? spo2Tone(vital.oxygenSaturation)
        : undefined,
    },
    { label: 'Weight', icon: Scale, value: vital.weightKg, unit: 'kg' },
    {
      label: 'BMI',
      icon: Ruler,
      value: vital.bmi,
      unit: has(vital.heightCm) ? `${vital.heightCm} cm` : undefined,
      tone: has(vital.bmi) ? bmiTone(Number(vital.bmi)) : undefined,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @4xl:grid-cols-6">
        {tiles.map((t) => {
          const empty = t.value === null || t.value === undefined
          return (
            <Card key={t.label} className="gap-0 p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <t.icon className="size-3.5" />
                  {t.label}
                </p>
                {!empty && t.tone && t.tone !== 'ok' && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[10px] font-medium',
                      t.tone === 'danger'
                        ? 'bg-danger-soft text-danger'
                        : 'bg-amber-soft text-amber',
                    )}
                  >
                    {TONE_LABEL[t.tone]}
                  </span>
                )}
              </div>
              <p
                className={cn(
                  'mt-1.5 text-xl font-semibold tabular-nums',
                  empty ? 'text-muted-foreground' : TONE_TEXT[t.tone ?? 'ok'],
                )}
              >
                {empty ? '—' : t.value}
                {!empty && t.unit && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {t.unit}
                  </span>
                )}
              </p>
            </Card>
          )
        })}
      </div>
      {(vital.notes ||
        vital.isDiabetic ||
        vital.isHypertensive ||
        vital.isPregnant ||
        vital.isOnBloodThinners ||
        vital.isOnAntibiotics) && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-text-2">
          <ConditionChips vital={vital} />
          {vital.notes && <span className="italic">“{vital.notes}”</span>}
        </div>
      )}
    </div>
  )
}

function RecordVitalsSheet({
  patientId,
  open,
  onOpenChange,
}: {
  patientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { form, isPending } = useVitalsForm({
    patientId,
    onSaved: () => onOpenChange(false),
  })
  const canSubmit = useStore(form.store, (s) => s.canSubmit)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)

  const numField = (
    name: VitalKey,
    fieldLabel: string,
    placeholder: string,
    unit: string,
  ) => (
    <form.Field name={name}>
      {(field) => (
        <div className="space-y-1.5">
          <Label htmlFor={`vital-${name}`} className="text-xs">
            {fieldLabel}
          </Label>
          <div className="relative">
            <NumberInput
              id={`vital-${name}`}
              mode={
                ['temperature', 'weightKg', 'heightCm'].includes(name)
                  ? 'decimal'
                  : 'integer'
              }
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder={placeholder}
              className="pr-12"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {unit}
            </span>
          </div>
          {fieldError(field) && (
            <p className="text-xs font-medium text-danger">
              {fieldError(field)}
            </p>
          )}
        </div>
      )}
    </form.Field>
  )

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset()
        onOpenChange(o)
      }}
      title="Record vitals"
      description="Fill in what you measured — every field is optional, but at least one is needed."
      submitLabel="Save vitals"
      isSubmitting={isPending || isSubmitting}
      submitDisabled={!canSubmit}
      onSubmit={() => void form.handleSubmit()}
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">Blood pressure</legend>
          <div className="grid grid-cols-2 gap-3">
            {numField('bpSystolic', 'Systolic', '120', 'mmHg')}
            {numField('bpDiastolic', 'Diastolic', '80', 'mmHg')}
          </div>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">Vitals</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {numField('pulseRate', 'Pulse', '72', 'bpm')}
            {numField('temperature', 'Temperature', '37', '°C')}
            {numField('oxygenSaturation', 'SpO₂', '98', '%')}
          </div>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-semibold">Body</legend>
          <div className="grid grid-cols-2 gap-3">
            {numField('weightKg', 'Weight', '70', 'kg')}
            {numField('heightCm', 'Height', '175', 'cm')}
          </div>
          <p className="text-xs text-muted-foreground">
            BMI is worked out from weight and height.
          </p>
        </fieldset>
        <form.Field name="notes">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor="vital-notes" className="text-xs">
                Notes
              </Label>
              <Textarea
                id="vital-notes"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Optional observations…"
                className="h-20 resize-none"
              />
            </div>
          )}
        </form.Field>
        <button type="submit" hidden />
      </form>
    </FormSheet>
  )
}

// ─── Dental health ────────────────────────────────────────────────────
const GUM_TONE: Record<GumCondition, string> = {
  [GumCondition.HEALTHY]: CHIP_TONES.success,
  [GumCondition.MILD_GINGIVITIS]: CHIP_TONES.warning,
  [GumCondition.MODERATE_GINGIVITIS]: CHIP_TONES.warning,
  [GumCondition.SEVERE_PERIODONTITIS]: CHIP_TONES.danger,
}

function DentalSection({
  patientId,
  canEdit,
}: {
  patientId: string
  canEdit: boolean
}) {
  const q = useDentalInfo(patientId)
  const info = q.data ?? undefined
  const [editOpen, setEditOpen] = useState(false)

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={Droplets}
        title="Dental health & habits"
        subtitle="Gums, hygiene habits and dental history."
        action={
          canEdit &&
          info && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
          )
        }
      />

      {q.isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : !info ? (
        <EmptyState
          icon={Smile}
          title="No dental info yet"
          description="Record gum condition, brushing habits and past extractions or surgeries."
          action={
            canEdit && (
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <Plus className="size-3.5" /> Add dental info
              </Button>
            )
          }
        />
      ) : (
        <DentalSummary info={info} />
      )}

      {canEdit && (
        <FormSheetHost open={editOpen}>
          <DentalInfoSheet
            patientId={patientId}
            existing={info}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
        </FormSheetHost>
      )}
    </section>
  )
}

/** Mounts the sheet's form fresh on every open, so it starts from saved values. */
function FormSheetHost({
  open,
  children,
}: {
  open: boolean
  children: ReactNode
}) {
  const [mountKey, setMountKey] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setMountKey((k) => k + 1)
  }
  return <div key={mountKey}>{children}</div>
}

function DentalSummary({ info }: { info: PatientDentalInfo }) {
  const habits = [
    { on: info.smokingStatus, label: 'Smoker', icon: Cigarette, bad: true },
    {
      on: info.tobaccoChewing,
      label: 'Chews tobacco',
      icon: Cigarette,
      bad: true,
    },
    {
      on: info.teethSensitivity,
      label: 'Teeth sensitivity',
      icon: Sparkles,
      bad: true,
    },
    {
      on: info.orthodonticHistory,
      label: 'Orthodontic history',
      icon: Smile,
      bad: false,
    },
  ].filter((h) => h.on)

  const notes = [
    { label: 'Teeth condition', value: info.teethConditionNotes },
    { label: 'Previous extractions', value: info.previousExtractions },
    { label: 'Previous surgeries', value: info.previousSurgeries },
    { label: 'Dentist notes', value: info.dentistNotes },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-3">
      <Card className="gap-4 p-4 shadow-sm">
        <SummaryItem label="Gum condition">
          <Chip
            className={cn('text-xs capitalize', GUM_TONE[info.gumCondition])}
          >
            {label(info.gumCondition)}
          </Chip>
        </SummaryItem>
        <SummaryItem label="Brushing">
          <span className="capitalize">{label(info.brushingFrequency)}</span>
        </SummaryItem>
        <SummaryItem label="Flossing">
          <span className="capitalize">{label(info.flossingFrequency)}</span>
        </SummaryItem>
        <SummaryItem label="Habits & history">
          {habits.length === 0 ? (
            <span className="text-sm text-muted-foreground">None noted</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {habits.map((h) => (
                <Chip
                  key={h.label}
                  className={cn(
                    'text-xs',
                    h.bad ? CHIP_TONES.warning : CHIP_TONES.info,
                  )}
                >
                  <h.icon className="size-3" /> {h.label}
                </Chip>
              ))}
            </div>
          )}
        </SummaryItem>
      </Card>

      <Card className="gap-0 p-0 shadow-sm @3xl:col-span-2">
        <div className="grid grid-cols-1 divide-y divide-border @xl:grid-cols-2 @xl:divide-y-0">
          {notes.map((n, i) => (
            <div
              key={n.label}
              className={cn(
                'p-4',
                i >= 2 && '@xl:border-t @xl:border-border',
                i % 2 === 1 && '@xl:border-l @xl:border-border',
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">
                {n.label}
              </p>
              <p
                className={cn(
                  'mt-1 whitespace-pre-wrap text-sm',
                  !n.value && 'italic text-muted-foreground',
                )}
              >
                {n.value || 'Nothing recorded'}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SummaryItem({
  label: itemLabel,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {itemLabel}
      </p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  )
}

/** Tap-to-pick chips — clearer than a dropdown for 3–4 fixed options. */
function ChoiceChips<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  name: string
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
            value === o
              ? 'border-primary bg-primary-soft text-primary-text'
              : 'border-border text-text-2 hover:bg-panel-2 hover:text-foreground',
          )}
        >
          {label(o)}
        </button>
      ))}
    </div>
  )
}

type HabitKey =
  'smokingStatus' | 'tobaccoChewing' | 'teethSensitivity' | 'orthodonticHistory'

const HABITS: { key: HabitKey; label: string; icon: LucideIcon }[] = [
  { key: 'smokingStatus', label: 'Smoker', icon: Cigarette },
  { key: 'tobaccoChewing', label: 'Chews tobacco', icon: Cigarette },
  { key: 'teethSensitivity', label: 'Teeth sensitivity', icon: Sparkles },
  { key: 'orthodonticHistory', label: 'Orthodontic history', icon: Smile },
]

type NoteKey =
  | 'teethConditionNotes'
  | 'previousExtractions'
  | 'previousSurgeries'
  | 'dentistNotes'

const NOTE_FIELDS: { key: NoteKey; label: string; placeholder: string }[] = [
  {
    key: 'teethConditionNotes',
    label: 'Teeth condition',
    placeholder: 'General teeth condition…',
  },
  {
    key: 'previousExtractions',
    label: 'Previous extractions',
    placeholder: 'e.g. 38, 48 removed in 2022',
  },
  {
    key: 'previousSurgeries',
    label: 'Previous surgeries',
    placeholder: 'Any previous dental surgeries…',
  },
  {
    key: 'dentistNotes',
    label: 'Dentist notes',
    placeholder: 'Additional observations…',
  },
]

function DentalInfoSheet({
  patientId,
  existing,
  open,
  onOpenChange,
}: {
  patientId: string
  existing?: PatientDentalInfo
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { form, isPending } = useDentalInfoForm({
    patientId,
    existing,
    onSaved: () => onOpenChange(false),
  })
  const canSubmit = useStore(form.store, (s) => s.canSubmit)
  const isDirty = useStore(form.store, (s) => s.isDirty)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? 'Edit dental info' : 'Add dental info'}
      description="Gums, hygiene habits and dental history."
      submitLabel={existing ? 'Save changes' : 'Save dental info'}
      isSubmitting={isPending || isSubmitting}
      submitDisabled={!canSubmit || (!!existing && !isDirty)}
      onSubmit={() => void form.handleSubmit()}
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <div className="space-y-4">
          <form.Field name="gumCondition">
            {(field) => (
              <div className="space-y-1.5">
                <Label className="text-xs">Gum condition</Label>
                <ChoiceChips
                  name="Gum condition"
                  value={field.state.value}
                  options={Object.values(GumCondition)}
                  onChange={(v) => field.handleChange(v)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="brushingFrequency">
            {(field) => (
              <div className="space-y-1.5">
                <Label className="text-xs">Brushing</Label>
                <ChoiceChips
                  name="Brushing"
                  value={field.state.value}
                  options={Object.values(BrushingFrequency)}
                  onChange={(v) => field.handleChange(v)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="flossingFrequency">
            {(field) => (
              <div className="space-y-1.5">
                <Label className="text-xs">Flossing</Label>
                <ChoiceChips
                  name="Flossing"
                  value={field.state.value}
                  options={Object.values(FlossingFrequency)}
                  onChange={(v) => field.handleChange(v)}
                />
              </div>
            )}
          </form.Field>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Habits & history</Label>
          <div className="grid grid-cols-2 gap-2">
            {HABITS.map((h) => (
              <form.Field key={h.key} name={h.key}>
                {(field) => (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={field.state.value}
                    onClick={() => field.handleChange(!field.state.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                      field.state.value
                        ? 'border-primary bg-primary-soft text-primary-text'
                        : 'border-border text-text-2 hover:bg-panel-2',
                    )}
                  >
                    <h.icon className="size-4 shrink-0" />
                    {h.label}
                  </button>
                )}
              </form.Field>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {NOTE_FIELDS.map((n) => (
            <form.Field key={n.key} name={n.key}>
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor={`dental-${n.key}`} className="text-xs">
                    {n.label}
                  </Label>
                  <Textarea
                    id={`dental-${n.key}`}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={n.placeholder}
                    className="h-20 resize-none"
                  />
                  {fieldError(field) && (
                    <p className="text-xs font-medium text-danger">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          ))}
        </div>
        <button type="submit" hidden />
      </form>
    </FormSheet>
  )
}
