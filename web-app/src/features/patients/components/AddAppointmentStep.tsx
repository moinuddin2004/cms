import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Switch } from '@/components/ui/switch'
import { fieldError } from '@/components/forms/fieldError'
import { formatInClinic } from '@/lib/datetime'
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Check,
  ChevronLeft,
  CalendarPlus,
  SkipForward,
  Footprints,
} from 'lucide-react'
import type { AppointmentType, Doctor } from '@/features/appointments/types'
import {
  APPOINTMENT_TYPE_OPTIONS,
  DURATION_OPTIONS,
} from '@/features/appointments/types'

import { useDoctors } from '@/features/appointments/hooks/useDoctors'
import { cn } from '@/lib/utils'
import { FORM_STEPS } from '../types'
import { useFirstAppointmentForm } from '../hooks/useFirstAppointmentForm'
import { useFirstWalkIn } from '../hooks/useFirstWalkIn'

// All steps including the appointment booking step
const ALL_STEPS = [...FORM_STEPS.map((s) => s.title), 'Book Appointment']

interface AddAppointmentStepProps {
  patientId: string
  patientName: string
  onSkip: () => void
  onDone: () => void
  onBack: () => void
}

export function AddAppointmentStep({
  patientId,
  patientName,
  onSkip,
  onDone,
  onBack,
}: AddAppointmentStepProps) {
  const { data: doctors = [] } = useDoctors()
  const { form, validation, applySuggestion, isPending } =
    useFirstAppointmentForm({ patientId, onDone })

  const walkIn = useFirstWalkIn({ patientId, onDone })
  const [mode, setMode] = useState<'book' | 'walkin'>('book')

  const activeStep = ALL_STEPS.length - 1 // last step

  return (
    <div className="flex flex-col gap-5">
      {/* ── Step Indicator (same style as PatientForm) ── */}
      <div className="flex items-center w-full">
        {ALL_STEPS.map((title, i) => (
          <div key={title} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                  i < activeStep
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : i === activeStep
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-background border-border text-muted-foreground',
                )}
              >
                {i < activeStep ? <Check size={11} /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-sm font-medium hidden sm:inline',
                  i === activeStep
                    ? 'text-primary-text'
                    : i < activeStep
                      ? 'text-brand-500'
                      : 'text-slate-400',
                )}
              >
                {title}
              </span>
            </div>
            {i < ALL_STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-px mx-3 transition-colors duration-300',
                  i < activeStep ? 'bg-brand-400' : 'bg-border',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Book a slot, or put the patient straight in the queue ── */}
      <div
        role="tablist"
        aria-label="How is the patient being seen"
        className="flex overflow-hidden rounded-lg border border-border text-xs"
      >
        {(
          [
            { key: 'book', icon: CalendarPlus, label: 'Book appointment' },
            { key: 'walkin', icon: Footprints, label: 'Walk-in (queue now)' },
          ] as const
        ).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 px-3 py-2 font-medium transition-colors',
              mode === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-accent',
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {mode === 'walkin' && (
        <div className="space-y-4">
          <div className="space-y-4 rounded-lg border border-border p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Walk-in
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Patient</Label>
                <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                  {patientName}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Doctor <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={walkIn.doctorId}
                  onValueChange={walkIn.setDoctorId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((d: Doctor) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.fullName} — {d.designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-reason">Reason for visit</Label>
              <Input
                id="walkin-reason"
                value={walkIn.reason}
                onChange={(e) => walkIn.setReason(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <label className="flex h-9 cursor-pointer items-center gap-2.5 text-sm">
              <Switch
                checked={walkIn.urgent}
                onCheckedChange={walkIn.setUrgent}
              />
              Urgent
            </label>
            {walkIn.urgent && (
              <Input
                value={walkIn.urgentReason}
                onChange={(e) => walkIn.setUrgentReason(e.target.value)}
                placeholder="Why is it urgent? *"
                aria-label="Urgent reason"
              />
            )}
            {walkIn.message && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{walkIn.message}</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={walkIn.isPending}
              className="gap-1.5"
            >
              <ChevronLeft size={15} /> Back
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onSkip}
                disabled={walkIn.isPending}
                className="gap-1.5 text-muted-foreground"
              >
                <SkipForward size={15} />
                Skip
              </Button>
              <Button
                type="button"
                disabled={!walkIn.canSubmit || walkIn.isPending}
                onClick={() => void walkIn.submit(!!walkIn.message)}
                className="gap-1.5"
              >
                {walkIn.isPending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Footprints size={15} />
                )}
                {walkIn.message ? 'Add anyway' : 'Add to queue'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Form ── */}
      <form
        className={mode === 'walkin' ? 'hidden' : undefined}
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Appointment Details
            </p>

            {/* Row 1: Patient (read-only) + Doctor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Patient</Label>
                <div className="flex items-center h-9 px-3 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground">
                  {patientName}
                </div>
              </div>

              <form.Field name="doctorId">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label>
                      Doctor <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(val) => field.handleChange(val)}
                    >
                      <SelectTrigger aria-invalid={!!fieldError(field)}>
                        <SelectValue placeholder="Select doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.map((d: Doctor) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.fullName} — {d.designation}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldErrorText message={fieldError(field)} />
                  </div>
                )}
              </form.Field>
            </div>

            {/* Row 2: Date + Time (full width) */}
            <div className="grid grid-cols-1 gap-4">
              <form.Field name="startTime">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label htmlFor="appt-startTime">
                      Date & Time <span className="text-destructive">*</span>
                    </Label>
                    <DateTimePicker
                      id="appt-startTime"
                      value={field.state.value}
                      onChange={(val) => field.handleChange(val)}
                    />
                    <FieldErrorText message={fieldError(field)} />
                  </div>
                )}
              </form.Field>
            </div>

            {/* Row 3: Duration + Type */}
            <div className="grid grid-cols-2 gap-4">
              <form.Field name="duration">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label>
                      Duration <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      clearable={false}
                      value={String(field.state.value)}
                      onValueChange={(val) => field.handleChange(Number(val))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldErrorText message={fieldError(field)} />
                  </div>
                )}
              </form.Field>

              <form.Field name="type">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(val) =>
                        field.handleChange(val as AppointmentType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APPOINTMENT_TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldErrorText message={fieldError(field)} />
                  </div>
                )}
              </form.Field>
            </div>

            {/* Validation feedback */}
            {validation && (
              <div
                className={cn(
                  'flex items-start gap-2 px-3 py-2 rounded-lg border text-sm',
                  validation.valid
                    ? 'bg-emerald-soft border-emerald/30 text-emerald'
                    : 'bg-danger-soft border-danger/30 text-danger',
                )}
              >
                {validation.valid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Time slot is available</span>
                  </>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{validation.reason}</span>
                    </div>
                    {validation.suggestedStartTime && (
                      <button
                        type="button"
                        onClick={applySuggestion}
                        className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        Apply suggested:{' '}
                        {formatInClinic(
                          validation.suggestedStartTime,
                          'hh:mm a',
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <form.Field name="isEmergency">
                {(field) => (
                  <label className="flex h-9 cursor-pointer items-center gap-2.5 text-sm">
                    <Switch
                      checked={field.state.value as boolean}
                      onCheckedChange={(v) => field.handleChange(v)}
                    />
                    Emergency
                  </label>
                )}
              </form.Field>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between mt-5">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isPending}
            className="gap-1.5"
          >
            <ChevronLeft size={15} /> Back
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              disabled={isPending}
              className="gap-1.5 text-muted-foreground"
            >
              <SkipForward size={15} />
              Skip
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => {
                const busy = isPending || isSubmitting
                return (
                  <Button
                    type="submit"
                    disabled={
                      !canSubmit ||
                      busy ||
                      (validation !== null && !validation.valid)
                    }
                    className="gap-1.5"
                  >
                    {busy ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CalendarPlus size={15} />
                    )}
                    Book Appointment
                  </Button>
                )
              }}
            </form.Subscribe>
          </div>
        </div>
      </form>
    </div>
  )
}

function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs font-medium text-danger">{message}</p>
}
