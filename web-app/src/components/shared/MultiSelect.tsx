import * as React from 'react'
import { CheckIcon, ChevronDownIcon, PlusIcon } from 'lucide-react'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  ComboboxClear,
  ComboboxEmpty,
  ComboboxSearch,
  comboboxItemClass,
  focusSoon,
  onListKeyDown,
} from '@/components/shared/combobox'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
}

/**
 * Multi-value combobox. The box shows the chosen values as removable chips
 * plus a clear-all ×; the popup has a search box on top and the options with
 * a check on each chosen one (it stays open while you pick).
 *
 * `creatable` lets the user add a value that isn't in `options` (free-form
 * tags): type it and press Enter or pick "Add …".
 */
export function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search',
  emptyText = 'No matches',
  creatable = false,
  disabled = false,
  invalid = false,
  className,
  'aria-label': ariaLabel,
}: {
  id?: string
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  creatable?: boolean
  disabled?: boolean
  invalid?: boolean
  className?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const searchRef = React.useRef<HTMLInputElement | null>(null)

  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])

  const q = query.trim()
  const shown = q
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options
  const canCreate =
    creatable &&
    q !== '' &&
    !value.includes(q) &&
    !options.some((o) => o.label.toLowerCase() === q.toLowerCase())
  const create = () => {
    if (!canCreate) return false
    onChange([...value, q])
    setQuery('')
    return true
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
      modal
    >
      <PopoverAnchor asChild>
        <div
          data-slot="multi-select"
          data-disabled={disabled ? '' : undefined}
          className={cn(
            'flex min-h-9 w-full flex-wrap items-center gap-1 rounded-[9px] border border-input bg-surface py-1 pl-1.5 pr-1 text-sm transition-[color,box-shadow] has-[[data-slot=multi-select-trigger]:focus-visible]:border-ring has-[[data-slot=multi-select-trigger]:focus-visible]:ring-[3px] has-[[data-slot=multi-select-trigger]:focus-visible]:ring-ring/40 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 dark:hover:bg-panel',
            invalid && 'border-destructive',
            className,
          )}
        >
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex max-w-full items-center gap-0.5 rounded-md bg-accent py-0.5 pl-2 pr-0.5 text-xs font-medium"
            >
              <span dir="auto" className="truncate">
                {labelOf(v)}
              </span>
              {!disabled && (
                <ComboboxClear
                  tooltip={`Remove ${labelOf(v)}`}
                  onClear={() => toggle(v)}
                  className="size-4"
                />
              )}
            </span>
          ))}
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-label={ariaLabel}
              aria-invalid={invalid || undefined}
              disabled={disabled}
              data-slot="multi-select-trigger"
              className="flex h-7 min-w-16 flex-1 items-center gap-2 rounded-md px-1.5 text-left text-muted-foreground outline-none disabled:cursor-not-allowed"
            >
              <span className="flex-1 truncate">
                {value.length === 0 ? placeholder : ''}
              </span>
              <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          {value.length > 0 && !disabled && (
            <ComboboxClear tooltip="Clear all" onClear={() => onChange([])} />
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={8}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          focusSoon(() => searchRef.current)
        }}
        onKeyDown={(e) => onListKeyDown(e, listRef.current, searchRef.current)}
        className="w-[max(var(--radix-popover-trigger-width),12rem)] max-w-[min(24rem,calc(100vw-1rem))] p-1"
      >
        <ComboboxSearch
          ref={searchRef}
          value={query}
          onChange={setQuery}
          list={() => listRef.current}
          onEnter={create}
          placeholder={searchPlaceholder}
        />
        <div
          ref={listRef}
          role="listbox"
          aria-multiselectable
          className="max-h-64 overflow-y-auto overscroll-contain"
        >
          {shown.map((o) => {
            const selected = value.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                data-combobox-item=""
                onClick={() => toggle(o.value)}
                className={cn(comboboxItemClass, selected && 'font-medium')}
              >
                <span dir="auto" className="min-w-0 flex-1 truncate">
                  {o.label}
                </span>
                {selected && (
                  <CheckIcon className="absolute right-2 size-4 text-primary-text" />
                )}
              </button>
            )
          })}
          {canCreate && (
            <button
              type="button"
              role="option"
              aria-selected={false}
              data-combobox-item=""
              onClick={create}
              className={comboboxItemClass}
            >
              <PlusIcon className="size-4 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">Add “{q}”</span>
            </button>
          )}
          {shown.length === 0 && !canCreate && (
            <ComboboxEmpty>
              {creatable && !q ? 'Type to add' : emptyText}
            </ComboboxEmpty>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
