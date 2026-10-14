import * as React from 'react'
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * The project's dropdown. Same pieces and props as the shadcn `Select`
 * (Select, SelectTrigger, SelectValue, SelectContent, SelectItem) so it drops
 * in anywhere, plus:
 *  - a search box that appears when the list is long (more than
 *    `SEARCH_THRESHOLD` options, or `searchable` on SelectContent);
 *  - a list that never grows past ~16rem — it scrolls instead.
 *
 * Use this instead of `@/components/ui/select` everywhere.
 */

const SEARCH_THRESHOLD = 7

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
    [value, open, disabled, query, onValueChange, version],
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

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<'button'> & { size?: 'sm' | 'default' }) {
  const { value, disabled, open, labels } = useSelectContext()
  const empty = value === undefined || value === '' || !labels.has(value)
  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        data-slot="select-trigger"
        data-size={size}
        data-placeholder={empty ? '' : undefined}
        className={cn(
          "flex w-fit items-center justify-between gap-2 rounded-[9px] border border-input bg-surface px-3 py-2 text-left text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-text-3 data-[size=default]:h-10 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:hover:bg-panel [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="size-4 opacity-50" />
      </button>
    </PopoverTrigger>
  )
}

function SelectContent({
  className,
  children,
  searchable,
  align = 'start',
}: {
  className?: string
  children: React.ReactNode
  /** Force the search box on or off. Default: on for long lists. */
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

  const showSearch = searchable ?? ctx.labels.size > SEARCH_THRESHOLD

  // How many items survive the current search, for the "no matches" line.
  React.useEffect(() => {
    if (!listEl) return
    setShown(listEl.querySelectorAll('[data-select-item]').length)
  })

  // Closed: render the items invisibly just so they can report their labels.
  if (!ctx.open) return <>{children}</>

  const move = (dir: 1 | -1, from: Element | null) => {
    const items = [
      ...(listRef.current?.querySelectorAll<HTMLElement>(
        '[data-select-item]:not([disabled])',
      ) ?? []),
    ]
    if (items.length === 0) return
    const at = from ? items.indexOf(from as HTMLElement) : -1
    const next = at === -1 ? (dir === 1 ? 0 : items.length - 1) : at + dir
    items[Math.max(0, Math.min(items.length - 1, next))]?.focus()
  }

  return (
    <PopoverContent
      align={align}
      sideOffset={4}
      collisionPadding={8}
      onOpenAutoFocus={(e) => {
        // Land on the search box when there is one, else on the chosen item.
        // Done by hand and retried: inside a Sheet/Dialog its focus trap can
        // pull focus back for a frame or two while the list mounts.
        e.preventDefault()
        const target = () =>
          showSearch
            ? searchRef.current
            : (listRef.current?.querySelector<HTMLElement>(
                '[aria-selected="true"]',
              ) ??
              listRef.current?.querySelector<HTMLElement>('[data-select-item]'))
        let tries = 0
        const focus = () => {
          const el = target()
          if (!el) return
          if (document.activeElement !== el) el.focus({ preventScroll: true })
          if (document.activeElement !== el && ++tries < 6) {
            setTimeout(focus, 40)
          }
        }
        focus()
        requestAnimationFrame(focus)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          move(
            e.key === 'ArrowDown' ? 1 : -1,
            document.activeElement?.hasAttribute('data-select-item')
              ? document.activeElement
              : null,
          )
        }
      }}
      className={cn(
        'w-[max(var(--radix-popover-trigger-width),10rem)] max-w-[min(24rem,calc(100vw-1rem))] p-1',
        className,
      )}
    >
      {showSearch && (
        <div className="relative mb-1 border-b border-border pb-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-[60%] text-text-3" />
          <input
            ref={searchRef}
            value={ctx.query}
            onChange={(e) => ctx.setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search options"
            className="h-8 w-full rounded-md bg-transparent pl-8 pr-2 text-sm outline-none placeholder:text-text-3"
          />
        </div>
      )}
      <div
        ref={setListRef}
        role="listbox"
        className="max-h-64 overflow-y-auto overscroll-contain"
      >
        {children}
        {shown === 0 && (
          <p className="px-2 py-3 text-center text-xs text-text-3">
            No matches
          </p>
        )}
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
      data-select-item=""
      data-slot="select-item"
      disabled={disabled}
      onClick={() => ctx.select(value)}
      className={cn(
        'relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-left text-sm outline-none hover:bg-accent focus:bg-accent disabled:pointer-events-none disabled:opacity-50',
        selected && 'font-medium',
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected && (
        <CheckIcon className="absolute right-2 size-4 text-primary-text" />
      )}
    </button>
  )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
