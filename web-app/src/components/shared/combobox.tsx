import * as React from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'

/**
 * Pieces shared by the single-select combobox (`SearchableSelect`) and
 * `MultiSelect`: the search row, the clear button, option styling and the
 * list's keyboard handling. Options are `[data-combobox-item]` buttons.
 */

const ITEM = '[data-combobox-item]:not([disabled])'

/** Options currently in the list, in order. */
function itemsOf(list: HTMLElement | null) {
  return [...(list?.querySelectorAll<HTMLElement>(ITEM) ?? [])]
}

/**
 * Focus an element once the popup has mounted. Retried for a few frames:
 * inside a Sheet/Dialog its focus trap can pull focus back while the
 * portaled list mounts.
 */
export function focusSoon(target: () => HTMLElement | null | undefined) {
  let tries = 0
  const focus = () => {
    const el = target()
    if (!el) return
    if (document.activeElement !== el) el.focus({ preventScroll: true })
    if (document.activeElement !== el && ++tries < 6) setTimeout(focus, 40)
  }
  focus()
  requestAnimationFrame(focus)
}

/**
 * Keyboard handling for the popup: arrows / Home / End move between options,
 * typing on an option jumps back to the search box. Enter and Space work
 * natively (options are buttons); Escape is handled by the Popover.
 */
export function onListKeyDown(
  e: React.KeyboardEvent,
  list: HTMLElement | null,
  search: HTMLInputElement | null,
) {
  const items = itemsOf(list)
  const active = document.activeElement as HTMLElement | null
  const at = active ? items.indexOf(active) : -1
  const go = (i: number) => {
    e.preventDefault()
    items[Math.max(0, Math.min(items.length - 1, i))]?.focus()
  }
  if (e.key === 'ArrowDown') go(at === -1 ? 0 : at + 1)
  else if (e.key === 'ArrowUp') {
    if (at <= 0 && search) {
      e.preventDefault()
      search.focus()
    } else go(at === -1 ? items.length - 1 : at - 1)
  } else if (at !== -1 && e.key === 'Home') go(0)
  else if (at !== -1 && e.key === 'End') go(items.length - 1)
  else if (
    at !== -1 &&
    search &&
    e.key.length === 1 &&
    e.key !== ' ' &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey
  ) {
    // Let the keystroke land in the search box.
    search.focus()
  }
}

/** The search row at the top of the popup. Enter picks the first match. */
export function ComboboxSearch({
  ref,
  value,
  onChange,
  list,
  onEnter,
  placeholder = 'Search',
}: {
  ref: React.Ref<HTMLInputElement>
  value: string
  onChange: (value: string) => void
  /** The option list, for Enter = pick first match. */
  list: () => HTMLElement | null
  /** Overrides Enter (e.g. to create a new value). Return true if handled. */
  onEnter?: () => boolean
  placeholder?: string
}) {
  return (
    <div className="relative mb-1">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (onEnter?.()) return
          itemsOf(list())[0]?.click()
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
      />
    </div>
  )
}

/** Class for an option row; the check mark sits on the right. */
export const comboboxItemClass =
  'relative flex w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-left text-sm outline-none hover:bg-accent focus:bg-accent disabled:pointer-events-none disabled:opacity-50'

/** The × that clears a value. */
export function ComboboxClear({
  onClear,
  tooltip = 'Clear',
  className,
}: {
  onClear: () => void
  tooltip?: string
  className?: string
}) {
  return (
    <TooltipButton
      tooltip={tooltip}
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={(e) => {
        e.stopPropagation()
        onClear()
      }}
      // Keep the popover from treating the press as an outside click / open.
      onPointerDown={(e) => e.stopPropagation()}
      className={cn(
        'size-5 shrink-0 rounded-sm text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <XIcon className="size-3.5" />
    </TooltipButton>
  )
}

export function ComboboxEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 py-3 text-center text-xs text-muted-foreground">
      {children}
    </p>
  )
}
