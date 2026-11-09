'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface TimePickerProps {
  /** 24h `HH:mm`, or '' when unset. */
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Minute step for the minute column (default 5). */
  minuteStep?: number
}

const pad = (n: number) => String(n).padStart(2, '0')

/** shadcn-style time picker: hour / minute / AM-PM columns in a popover. */
export function TimePicker({
  value,
  onChange,
  placeholder = 'Time',
  disabled,
  className,
  minuteStep = 5,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [h24, m] = value
    ? value.split(':').map(Number)
    : [undefined, undefined]
  const has = h24 !== undefined && !Number.isNaN(h24)
  const isPm = has && h24! >= 12
  const h12 = has ? h24! % 12 || 12 : undefined

  const emit = (hour12: number, minute: number, pm: boolean) =>
    onChange?.(`${pad((hour12 % 12) + (pm ? 12 : 0))}:${pad(minute)}`)

  const minutes = Array.from(
    { length: Math.ceil(60 / minuteStep) },
    (_, i) => i * minuteStep,
  )
  const label = has
    ? `${pad(h12!)}:${pad(m ?? 0)} ${isPm ? 'PM' : 'AM'}`
    : placeholder

  const item = (active: boolean) =>
    cn('w-full justify-center', active && 'pointer-events-none')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start font-normal',
            !has && 'text-muted-foreground',
            className,
          )}
        >
          <Clock className="mr-2 size-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex divide-x">
          <div className="h-56 w-16 overflow-y-auto">
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <Button
                  key={h}
                  type="button"
                  size="sm"
                  variant={h12 === h ? 'default' : 'ghost'}
                  className={item(h12 === h)}
                  onClick={() => emit(h, m ?? 0, !!isPm)}
                >
                  {pad(h)}
                </Button>
              ))}
            </div>
          </div>
          <div className="h-56 w-16 overflow-y-auto">
            <div className="flex flex-col gap-1 p-2">
              {minutes.map((min) => (
                <Button
                  key={min}
                  type="button"
                  size="sm"
                  variant={has && m === min ? 'default' : 'ghost'}
                  className={item(has && m === min)}
                  onClick={() => emit(h12 ?? 12, min, !!isPm)}
                >
                  {pad(min)}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 p-2">
            {(['AM', 'PM'] as const).map((p) => (
              <Button
                key={p}
                type="button"
                size="sm"
                variant={has && isPm === (p === 'PM') ? 'default' : 'ghost'}
                onClick={() => emit(h12 ?? 12, m ?? 0, p === 'PM')}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
