import { Button } from '@/components/ui/button'
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

      {/* ── Form ── */}
      <form
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

            {/* Row 2: Date+Time + Duration */}
            <div className="grid grid-cols-2 gap-4">
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

            {/* Row 3: Type + Walk-in + Emergency */}
            <div className="grid grid-cols-3 gap-4 items-end">
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

              <form.Field name="isEmergency">
                {(field) => (
                  <label className="flex items-center gap-2.5 text-sm cursor-pointer h-9">
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
