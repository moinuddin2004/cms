import { useState, useEffect } from 'react'
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
import { useSetSchedule } from '../hooks/useSetSchedule'
import { DAY_NAMES, SLOT_OPTIONS, type ScheduleDay } from '../types'
import { Clock, Save, Loader2, Calendar } from 'lucide-react'

interface ScheduleTabProps {
  employeeId: string
}

const DEFAULT_SCHEDULE: ScheduleDay[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  isWorking: i >= 1 && i <= 5, // Mon-Fri
  startTime: i >= 1 && i <= 5 ? '09:00' : null,
  endTime: i >= 1 && i <= 5 ? '17:00' : null,
  slotDuration: 30,
}))

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
  const setScheduleMutation = useSetSchedule(employeeId)

  const [schedule, setSchedule] = useState<ScheduleDay[]>(DEFAULT_SCHEDULE)
  const [slotDuration, setSlotDuration] = useState(30)
  const [isDirty, setIsDirty] = useState(false)

  // Sync from server once fetched
  useEffect(() => {
    if (serverSchedule && serverSchedule.length === 7) {
      setSchedule(
        serverSchedule
          .map((d) => ({ ...d }))
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      )
      // Use slot duration from first working day
      const firstWorking = serverSchedule.find((d) => d.isWorking)
      if (firstWorking?.slotDuration) setSlotDuration(firstWorking.slotDuration)
      setIsDirty(false)
    }
  }, [serverSchedule])

  const updateDay = (dayIdx: number, updates: Partial<ScheduleDay>) => {
    setSchedule((prev) =>
      prev.map((d) => (d.dayOfWeek === dayIdx ? { ...d, ...updates } : d)),
    )
    setIsDirty(true)
  }

  const toggleWorking = (dayIdx: number, isWorking: boolean) => {
    updateDay(dayIdx, {
      isWorking,
      startTime: isWorking ? '09:00' : null,
      endTime: isWorking ? '17:00' : null,
    })
  }

  const handleSave = () => {
    setScheduleMutation.mutate(
      {
        slotDuration,
        schedule: schedule.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isWorking: d.isWorking,
          startTime: d.isWorking ? d.startTime || '09:00' : undefined,
          endTime: d.isWorking ? d.endTime || '17:00' : undefined,
        })),
      },
      { onSuccess: () => setIsDirty(false) },
    )
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Weekly Schedule</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Slot:</span>
              <Select
                clearable={false}
                value={String(slotDuration)}
                onValueChange={(v) => {
                  setSlotDuration(Number(v))
                  setIsDirty(true)
                }}
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
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || setScheduleMutation.isPending}
            >
              {setScheduleMutation.isPending ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1 h-3.5 w-3.5" />
              )}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {schedule.map((day) => (
          <div
            key={day.dayOfWeek}
            className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors ${
              day.isWorking
                ? 'bg-background border-border'
                : 'bg-muted/50 border-transparent'
            }`}
          >
            {/* Day name */}
            <div className="w-24 flex items-center gap-2">
              <Switch
                checked={day.isWorking}
                onCheckedChange={(val) => toggleWorking(day.dayOfWeek, val)}
              />
              <span
                className={`text-sm font-medium ${day.isWorking ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {DAY_NAMES[day.dayOfWeek]}
              </span>
            </div>

            {/* Times or OFF */}
            {day.isWorking ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  value={day.startTime || '09:00'}
                  onChange={(e) =>
                    updateDay(day.dayOfWeek, { startTime: e.target.value })
                  }
                  className="w-32 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={day.endTime || '17:00'}
                  onChange={(e) =>
                    updateDay(day.dayOfWeek, { endTime: e.target.value })
                  }
                  className="w-32 h-8 text-sm"
                />
                <span className="ml-2 text-xs text-muted-foreground">
                  {to12h(day.startTime)} – {to12h(day.endTime)}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground italic">
                Day off
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
