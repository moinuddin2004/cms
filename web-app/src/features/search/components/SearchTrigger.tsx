import { Search } from 'lucide-react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { useSearchStore } from '../hooks/useSearchStore'
import { CommandPalette } from './CommandPalette'

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * Topbar entry to the quick search: a search-box-looking button on wider
 * screens, an icon on phones. Also mounts the palette + its Ctrl+K shortcut.
 */
export function SearchTrigger() {
  const setOpen = useSearchStore((s) => s.setOpen)
  const shortcut = isMac ? '⌘K' : 'Ctrl K'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
        className="hidden h-[38px] w-64 items-center gap-2 rounded-[9px] border border-border bg-surface px-3 text-sm text-muted-foreground transition-colors hover:bg-panel hover:text-foreground md:flex lg:w-80"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">
          Search patients, pages…
        </span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
          {shortcut}
        </kbd>
      </button>
      <TooltipButton
        tooltip={`Search (${shortcut})`}
        variant="outline"
        size="icon"
        className="size-[38px] md:hidden"
        onClick={() => setOpen(true)}
      >
        <Search className="size-[18px]" />
      </TooltipButton>
      <CommandPalette />
    </>
  )
}
