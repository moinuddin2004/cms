import * as React from 'react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import {
  Popover,
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

/**
 * The project's dropdown — a combobox. Same pieces and props as the shadcn
 * `Select` (Select, SelectTrigger, SelectValue, SelectContent, SelectItem) so
 * it drops in anywhere. The trigger shows the chosen label, a × to clear it
 * and a chevron; the popup opens with a search box on top, then the options
 * with a check on the chosen one.
 *
 * Clearing goes back to the list's "all"/"none" option when it has one
 * (filters, optional pickers), else to "". Turn it off with
 * `clearable={false}` where "nothing" isn't a valid value (page size, month).
 *
 * Use this instead of `@/components/ui/select` everywhere. For several values
 * use `MultiSelect`.
 */

/** Option values that mean "no choice"; clearing selects them. */
const RESET_VALUES = ['all', 'none']

/** Plain text of whatever an item renders, for searching. */
function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return textOf(node.props.children)
  }
  return ''
}

interface SelectContextValue {
  value: string | undefined
  select: (value: string) => void
  open: boolean
  disabled: boolean
  clearable: boolean
  /** Items report themselves so the trigger can show the chosen label. */
  labels: Map<string, React.ReactNode>
  register: (value: string, label: React.ReactNode) => void
  query: string
  setQuery: (query: string) => void
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelectContext() {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error('Select parts must be used inside <Select>')
  return ctx
}

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Show the × on the trigger. Default true; off when `required`. */
  clearable?: boolean
  /** Accepted for compatibility with the shadcn Select; unused. */
  name?: string
  required?: boolean
  children: React.ReactNode
}

function Select({
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  open: openProp,
  onOpenChange,
  clearable = true,
  required = false,
  children,
}: SelectProps) {
  const [inner, setInner] = React.useState(defaultValue)
  const [innerOpen, setInnerOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [version, bump] = React.useReducer((n: number) => n + 1, 0)
  const labels = React.useRef(new Map<string, React.ReactNode>())

  const value = valueProp !== undefined ? valueProp : inner
  const open = openProp !== undefined ? openProp : innerOpen

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInnerOpen(next)
    onOpenChange?.(next)
    if (!next) setQuery('')
  }

  const ctx = React.useMemo<SelectContextValue>(
    () => ({
      value,
      open,
      disabled,
      clearable: clearable && !required,
      query,
      setQuery,
      labels: labels.current,
      select: (v) => {
        if (valueProp === undefined) setInner(v)
        onValueChange?.(v)
        setOpen(false)
      },
      register: (v, label) => {
        if (labels.current.get(v) !== label) {
          labels.current.set(v, label)
          bump()
        }
      },
    }),
    [value, open, disabled, clearable, required, query, onValueChange, version],
  )

  return (
    <SelectContext.Provider value={ctx}>
      {/* modal: inside a Dialog/Sheet the portaled list would otherwise sit
          under the dialog's scroll-lock + pointer-events block, so it
          couldn't scroll, be clicked or take typing. */}
      <Popover open={open} onOpenChange={setOpen} modal>
        {children}
      </Popover>
    </SelectContext.Provider>
  )
}

function SelectValue({
  placeholder,
  className,
}: {
  placeholder?: React.ReactNode
  className?: string
}) {
  const { value, labels } = useSelectContext()
  const label = value !== undefined ? labels.get(value) : undefined
  return (
    <span data-slot="select-value" className={cn('line-clamp-1', className)}>
      {label ?? placeholder}
    </span>
  )
}

/**
 * A bordered box holding the trigger button (label + chevron) and, when a
 * value is set, the × — a sibling, since buttons can't nest. `className`
 * styles the box; the rest of the props go to the button (id, aria-*).
 */
function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<'button'> & { size?: 'sm' | 'default' }) {
  const { value, disabled, open, labels, clearable, select } =
    useSelectContext()
  const empty = value === undefined || value === '' || !labels.has(value)
  const reset = RESET_VALUES.find((v) => labels.has(v)) ?? ''
  const showClear = clearable && !disabled && !empty && value !== reset

  return (
    <div
      data-slot="select-trigger"
      data-size={size}
      data-placeholder={empty ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      className={cn(
        'relative inline-flex w-fit items-center rounded-[9px] border border-input bg-surface text-sm whitespace-nowrap transition-[color,box-shadow] data-[size=default]:h-10 data-[size=sm]:h-8 has-[[data-slot=select-trigger-button]:focus-visible]:border-ring has-[[data-slot=select-trigger-button]:focus-visible]:ring-[3px] has-[[data-slot=select-trigger-button]:focus-visible]:ring-ring/40 has-[[aria-invalid=true]]:border-destructive data-[placeholder]:text-text-3 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 dark:hover:bg-panel [&_svg]:shrink-0',
        className,
      )}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          data-slot="select-trigger-button"
          className="flex h-full w-full min-w-0 items-center gap-2 rounded-[inherit] px-3 text-left outline-none disabled:cursor-not-allowed *:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
          {...props}
        >
          {children}
          {/* Room for the × that sits over this spot. */}
          {showClear && <span aria-hidden className="w-5 shrink-0" />}
          <ChevronDownIcon className="size-4 opacity-50" />
        </button>
      </PopoverTrigger>
      {showClear && (
        <ComboboxClear
          onClear={() => select(reset)}
          className="absolute right-9 top-1/2 -translate-y-1/2"
        />
      )}
    </div>
  )
}

function SelectContent({
  className,
  children,
  searchable = true,
  align = 'start',
}: {
  className?: string
  children: React.ReactNode
  /** Show the search row. Default true. */
  searchable?: boolean
  align?: 'start' | 'center' | 'end'
  /** Accepted for compatibility with the shadcn Select; unused. */
  position?: string
}) {
  const ctx = useSelectContext()
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const searchRef = React.useRef<HTMLInputElement | null>(null)
  const setListRef = React.useCallback((el: HTMLDivElement | null) => {
    listRef.current = el
    setListEl(el)
  }, [])
  // The list lives in a portal that mounts a render after `open` flips, so
  // track it in state — the count below re-runs once it actually exists.
  const [listEl, setListEl] = React.useState<HTMLDivElement | null>(null)
  const [shown, setShown] = React.useState(1)

  // How many items survive the current search, for the "no matches" line.
  React.useEffect(() => {
    if (!listEl) return
    setShown(listEl.querySelectorAll('[data-combobox-item]').length)
  })

  // Closed: render the items invisibly just so they can report their labels.
  if (!ctx.open) return <>{children}</>

  return (
    <PopoverContent
      align={align}
      sideOffset={4}
      collisionPadding={8}
      onOpenAutoFocus={(e) => {
        // Land on the search box when there is one, else on the chosen item.
        e.preventDefault()
        focusSoon(() =>
          searchable
            ? searchRef.current
            : (listRef.current?.querySelector<HTMLElement>(
                '[aria-selected="true"]',
              ) ??
              listRef.current?.querySelector<HTMLElement>(
                '[data-combobox-item]',
              )),
        )
      }}
      onKeyDown={(e) => onListKeyDown(e, listRef.current, searchRef.current)}
      className={cn(
        'w-[max(var(--radix-popover-trigger-width),10rem)] max-w-[min(24rem,calc(100vw-1rem))] p-1',
        className,
      )}
    >
      {searchable && (
        <ComboboxSearch
          ref={searchRef}
          value={ctx.query}
          onChange={ctx.setQuery}
          list={() => listRef.current}
        />
      )}
      <div
        ref={setListRef}
        role="listbox"
        className="max-h-64 overflow-y-auto overscroll-contain"
      >
        {children}
        {shown === 0 && <ComboboxEmpty>No matches</ComboboxEmpty>}
      </div>
    </PopoverContent>
  )
}

function SelectItem({
  value,
  disabled,
  className,
  children,
}: {
  value: string
  disabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  const ctx = useSelectContext()
  const { register } = ctx

  React.useLayoutEffect(() => {
    register(value, children)
  }, [value, textOf(children)])

  // Closed: only reporting the label.
  if (!ctx.open) return null

  const q = ctx.query.trim().toLowerCase()
  if (q && !textOf(children).toLowerCase().includes(q)) return null

  const selected = ctx.value === value
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      data-combobox-item=""
      data-slot="select-item"
      disabled={disabled}
      onClick={() => ctx.select(value)}
      className={cn(comboboxItemClass, selected && 'font-medium', className)}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected && (
        <CheckIcon className="absolute right-2 size-4 text-primary-text" />
      )}
    </button>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
