import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useEmployeeSchedule } from '../hooks/useEmployeeSchedule'
import { useScheduleForm } from '../hooks/useScheduleForm'
import type { ScheduleFormValues } from '../schemas/schedule.schema'
import { DAY_NAMES, SLOT_OPTIONS } from '../types'
import { fieldError } from '@/components/forms/fieldError'
import { Clock, Save, Loader2, Calendar } from 'lucide-react'

interface ScheduleTabProps {
  employeeId: string
}

/** Convert 24h "HH:MM" to 12h display string */
function to12h(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

export function ScheduleTab({ employeeId }: ScheduleTabProps) {
  const { data: serverSchedule, isLoading } = useEmployeeSchedule(employeeId)
  const form = useScheduleForm(employeeId, serverSchedule)

  const toggleWorking = (i: number, isWorking: boolean) => {
    form.setFieldValue(`days[${i}].isWorking`, isWorking)
    form.setFieldValue(`days[${i}].startTime`, isWorking ? '09:00' : '')
    form.setFieldValue(`days[${i}].endTime`, isWorking ? '17:00' : '')
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg font-medium">
                Weekly schedule
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Working hours used for booking.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Slot</span>
              <form.Field name="slotDuration">
                {(field) => (
                  <Select
                    clearable={false}
                    value={field.state.value}
                    onValueChange={(v) =>
                      field.handleChange(
                        v as ScheduleFormValues['slotDuration'],
                      )
                    }
                  >
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SLOT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </form.Field>
            </div>
            <form.Subscribe
              selector={(s) =>
                [s.canSubmit, s.isSubmitting, s.isDirty] as const
              }
            >
              {([canSubmit, isSubmitting, isDirty]) => (
                <Button
                  size="sm"
                  onClick={() => void form.handleSubmit()}
                  disabled={!isDirty || !canSubmit || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
              )}
            </form.Subscribe>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <form.Subscribe selector={(s) => s.values.days}>
          {(days) =>
            days.map((day, i) => (
              <div
                key={day.dayOfWeek}
                className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3 transition-colors ${
                  day.isWorking
                    ? 'border-border bg-background'
                    : 'border-transparent bg-muted/50'
                }`}
              >
                {/* Day name */}
                <div className="flex w-32 items-center gap-2">
                  <Switch
                    checked={day.isWorking}
                    onCheckedChange={(val) => toggleWorking(i, val)}
                  />
                  <span
                    className={`text-sm font-medium ${day.isWorking ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {DAY_NAMES[day.dayOfWeek]}
                  </span>
                </div>

                {/* Times or OFF */}
                {day.isWorking ? (
                  <form.Field name={`days[${i}].startTime`}>
                    {(start) => (
                      <form.Field name={`days[${i}].endTime`}>
                        {(end) => {
                          const startError = fieldError(start)
                          const endError = fieldError(end)
                          return (
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  type="time"
                                  aria-label={`${DAY_NAMES[day.dayOfWeek]} start`}
                                  aria-invalid={!!startError}
                                  value={start.state.value}
                                  onChange={(e) =>
                                    start.handleChange(e.target.value)
                                  }
                                  onBlur={start.handleBlur}
                                  className="h-8 w-32 text-sm dark:[color-scheme:dark]"
                                />
                                <span className="text-xs text-muted-foreground">
                                  to
                                </span>
                                <Input
                                  type="time"
                                  aria-label={`${DAY_NAMES[day.dayOfWeek]} end`}
                                  aria-invalid={!!endError}
                                  value={end.state.value}
                                  onChange={(e) =>
                                    end.handleChange(e.target.value)
                                  }
                                  onBlur={end.handleBlur}
                                  className="h-8 w-32 text-sm dark:[color-scheme:dark]"
                                />
                                <span className="ml-2 hidden text-xs text-muted-foreground md:inline">
                                  {to12h(start.state.value)} –{' '}
                                  {to12h(end.state.value)}
                                </span>
                              </div>
                              {(startError || endError) && (
                                <p className="text-xs font-medium text-danger">
                                  {startError ?? endError}
                                </p>
                              )}
                            </div>
                          )
                        }}
                      </form.Field>
                    )}
                  </form.Field>
                ) : (
                  <span className="text-sm text-muted-foreground italic">
                    Day off
                  </span>
                )}
              </div>
            ))
          }
        </form.Subscribe>
      </CardContent>
    </Card>
  )
}
