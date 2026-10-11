import { useMemo, useState } from 'react'
import { format, isValid } from 'date-fns'
import type { Matcher } from 'react-day-picker'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DatePickerProps {
  /** Date as `yyyy-MM-dd` (same shape a native date input uses). */
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** Earliest / latest selectable date, `yyyy-MM-dd`. */
  min?: string
  max?: string
  /** Show month + year dropdowns — use for far-away dates such as date of birth. */
  withYearDropdown?: boolean
  /** Show a "Clear" action (only useful for optional fields). */
  clearable?: boolean
  hideIcon?: boolean
  id?: string
  className?: string
  align?: 'start' | 'center' | 'end'
}

// Anchor at noon so timezone math never rolls the day over.
const fromYMD = (v: string) => new Date(v + 'T12:00:00')
const toYMD = (d: Date) => format(d, 'yyyy-MM-dd')

/**
 * shadcn date picker (Popover + Calendar). Drop-in replacement for
 * `<Input type="date">` — never use the native date input.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  min,
  max,
  withYearDropdown,
  clearable,
  hideIcon,
  id,
  className,
  align = 'start',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const selected = useMemo(() => {
    if (!value) return undefined
    const d = fromYMD(value)
    return isValid(d) ? d : undefined
  }, [value])

  const minDate = min ? fromYMD(min) : undefined
  const maxDate = max ? fromYMD(max) : undefined
  const today = new Date()
  const disabledDays: Matcher[] = []
  if (minDate) disabledDays.push({ before: minDate })
  if (maxDate) disabledDays.push({ after: maxDate })
  const todayDisabled =
    (!!minDate && today < minDate) || (!!maxDate && today > maxDate)

  const select = (day: Date) => {
    onChange(toYMD(day))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          {!hideIcon && <CalendarIcon className="size-4 shrink-0" />}
          <span className="truncate">
            {selected ? format(selected, 'MMM d, yyyy') : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? maxDate ?? today}
          onSelect={(day) => day && select(day)}
          disabled={disabledDays.length ? disabledDays : undefined}
          captionLayout={withYearDropdown ? 'dropdown' : 'label'}
          startMonth={withYearDropdown ? (minDate ?? new Date(1900, 0)) : minDate}
          endMonth={withYearDropdown ? (maxDate ?? new Date(today.getFullYear() + 10, 11)) : maxDate}
          classNames={{
            dropdowns: 'flex h-8 items-center justify-center gap-1.5 text-sm font-medium',
            dropdown_root:
              'relative rounded-md border border-input shadow-xs has-[:focus]:border-ring has-[:focus]:ring-[3px] has-[:focus]:ring-ring/50',
            dropdown: 'absolute inset-0 cursor-pointer bg-popover opacity-0',
            caption_label: withYearDropdown
              ? 'flex h-8 items-center gap-1 pl-2 pr-1 text-sm font-medium'
              : 'text-sm font-medium',
          }}
          autoFocus
        />
        {(clearable || !disabled) && (
          <div className="flex items-center justify-between border-t px-3 py-2">
            {clearable ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                Clear
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-primary"
              disabled={todayDisabled}
              onClick={() => select(today)}
            >
              Today
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
