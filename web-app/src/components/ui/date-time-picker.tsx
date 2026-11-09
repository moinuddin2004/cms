'use client'

import * as React from 'react'
import { format, isValid } from 'date-fns'
import { CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { TimePicker } from '@/components/ui/time-picker'

interface DateTimePickerProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Pick date & time',
  disabled,
  className,
  id,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)

  const parsed = React.useMemo(() => {
    if (!value) return undefined
    const d = new Date(value)
    return isValid(d) ? d : undefined
  }, [value])

  const timeValue = parsed ? format(parsed, 'HH:mm') : ''

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return
    const hours = parsed ? parsed.getHours() : new Date().getHours()
    const mins = parsed ? parsed.getMinutes() : 0
    const result = new Date(day)
    result.setHours(hours, mins, 0, 0)
    onChange?.(format(result, "yyyy-MM-dd'T'HH:mm"))
    setOpen(false)
  }

  const handleTimeChange = (next: string) => {
    const [h, m] = next.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return
    const base = parsed ? new Date(parsed) : new Date()
    base.setHours(h, m, 0, 0)
    onChange?.(format(base, "yyyy-MM-dd'T'HH:mm"))
  }

  const displayLabel = parsed ? format(parsed, 'MMM d, yyyy') : placeholder

  return (
    <div className={cn('flex gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'flex-1 justify-start text-left font-normal',
              !parsed && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{displayLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parsed}
            onSelect={handleDaySelect}
            autoFocus
          />
        </PopoverContent>
      </Popover>

      <TimePicker
        value={timeValue}
        onChange={handleTimeChange}
        disabled={disabled}
        className="w-[120px] shrink-0"
      />
    </div>
  )
}
