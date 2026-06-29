'use client'

import * as React from 'react'
import { format, isValid } from 'date-fns'
import { CalendarIcon, Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

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

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [h, m] = e.target.value.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return
    const base = parsed ? new Date(parsed) : new Date()
    base.setHours(h, m, 0, 0)
    onChange?.(format(base, "yyyy-MM-dd'T'HH:mm"))
  }

  const displayLabel = parsed
    ? format(parsed, 'MMM d, yyyy  hh:mm a')
    : placeholder

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

      <div className="relative">
        <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="time"
          value={timeValue}
          onChange={handleTimeChange}
          disabled={disabled}
          className="w-[110px] pl-8"
        />
      </div>
    </div>
  )
}
