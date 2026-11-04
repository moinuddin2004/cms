import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Clock, SearchX, User } from 'lucide-react'
import type { ElementType } from 'react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSearchStore } from '../hooks/useSearchStore'
import { useGlobalSearch } from '../hooks/useGlobalSearch'
import { useRecentItems } from '../hooks/useRecentItems'
import { useStaticItems } from '../hooks/useStaticItems'
import { filterStatic, splitMatch } from '../lib/query'
import type { RecentItem, SearchType, StaticSearchItem } from '../types'

const GROUP_LABEL: Record<SearchType, string> = { patients: 'Patients' }
const GROUP_ICON: Record<SearchType, ElementType> = { patients: User }
/** "See all" opens the listing filtered by the query. */
const GROUP_LISTING: Record<SearchType, string> = { patients: '/patients' }

function Highlight({ text, query }: { text: string; query: string }) {
  const parts = splitMatch(text, query)
  if (!parts) return <>{text}</>
  return (
    <>
      {parts.before}
      <span className="font-semibold text-foreground">{parts.match}</span>
      {parts.after}
    </>
  )
}

/** Ctrl+K / ⌘K anywhere opens the palette; again closes it. */
function useShortcut() {
  const toggle = useSearchStore((s) => s.toggle)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])
}

export function CommandPalette() {
  useShortcut()
  const open = useSearchStore((s) => s.open)
  const setOpen = useSearchStore((s) => s.setOpen)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { pages, actions } = useStaticItems()
  const recent = useRecentItems()
  const search = useGlobalSearch(query)

  // Fresh palette each time it opens.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const go = (href: string, item?: RecentItem) => {
    if (item) recent.remember(item)
    setOpen(false)
    void navigate({ href })
  }
  const goStatic = (s: StaticSearchItem) =>
    go(s.href, {
      id: s.id,
      kind: s.kind,
      title: s.label,
      subtitle: null,
      href: s.href,
    })

  const typed = query.trim()
  const matchedPages = filterStatic(pages, typed)
  const matchedActions = typed ? filterStatic(actions, typed, 4) : actions
  const groups = search.enabled ? (search.data?.groups ?? []) : []
  const serverPending =
    search.enabled && (search.isDebouncing || search.isFetching)
  const showSkeleton = serverPending && groups.length === 0
  const nothingFound =
    !!typed &&
    !serverPending &&
    !search.isError &&
    groups.length === 0 &&
    matchedPages.length === 0 &&
    matchedActions.length === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Quick search</DialogTitle>
        <DialogDescription className="sr-only">
          Search patients, pages and actions
        </DialogDescription>
        <Command shouldFilter={false} loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search patients by name, phone, MR# or CNIC, or a page…"
            className="h-12"
          />
          <CommandList className="max-h-[min(60vh,420px)]">
            {!typed && recent.items.length > 0 && (
              <CommandGroup heading="Recent">
                {recent.items.map((r) => (
                  <CommandItem
                    key={`recent-${r.kind}-${r.id}`}
                    value={`recent-${r.kind}-${r.id}`}
                    onSelect={() => go(r.href, r)}
                  >
                    <Clock />
                    <span className="truncate">{r.title}</span>
                    {r.subtitle && (
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {r.subtitle}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {groups.map((g) => {
              const Icon = GROUP_ICON[g.type]
              return (
                <CommandGroup key={g.type} heading={GROUP_LABEL[g.type]}>
                  {g.items.map((it) => (
                    <CommandItem
                      key={`${g.type}-${it.id}`}
                      value={`${g.type}-${it.id}`}
                      onSelect={() =>
                        go(it.href, {
                          id: it.id,
                          kind: it.type,
                          title: it.title,
                          subtitle: it.subtitle,
                          href: it.href,
                        })
                      }
                      className="py-2"
                    >
                      <Icon />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">
                          <Highlight text={it.title} query={search.debouncedQuery} />
                        </div>
                        {it.subtitle && (
                          <div className="truncate text-xs text-muted-foreground">
                            <Highlight
                              text={it.subtitle}
                              query={search.debouncedQuery}
                            />
                          </div>
                        )}
                      </div>
                      {it.badges.map((b) => (
                        <Badge key={b} variant="secondary" className="shrink-0">
                          {b}
                        </Badge>
                      ))}
                    </CommandItem>
                  ))}
                  {g.hasMore && (
                    <CommandItem
                      value={`${g.type}-see-all`}
                      onSelect={() => {
                        setOpen(false)
                        void navigate({
                          href: `${GROUP_LISTING[g.type]}?search=${encodeURIComponent(search.debouncedQuery)}`,
                        })
                      }}
                      className="text-muted-foreground"
                    >
                      <ArrowRight />
                      See all {GROUP_LABEL[g.type].toLowerCase()} matching “
                      {search.debouncedQuery}”
                    </CommandItem>
                  )}
                </CommandGroup>
              )
            })}

            {showSkeleton && (
              <div className="space-y-2 p-3" aria-label="Searching">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-5 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {search.isError && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  Search failed. Pages and actions still work.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void search.refetch()}
                >
                  Retry
                </Button>
              </div>
            )}

            {matchedPages.length > 0 && (
              <CommandGroup heading="Pages">
                {matchedPages.map((p) => (
                  <CommandItem key={p.id} value={p.id} onSelect={() => goStatic(p)}>
                    <p.icon />
                    <Highlight text={p.label} query={typed} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {matchedActions.length > 0 && (
              <>
                {(groups.length > 0 || matchedPages.length > 0) && (
                  <CommandSeparator />
                )}
                <CommandGroup heading="Actions">
                  {matchedActions.map((a) => (
                    <CommandItem key={a.id} value={a.id} onSelect={() => goStatic(a)}>
                      <a.icon />
                      <Highlight text={a.label} query={typed} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {typed && !search.enabled && matchedPages.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Keep typing — 2 letters or 3 digits to search patients.
              </p>
            )}

            {nothingFound && search.enabled && (
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <SearchX className="size-6" />
                  <span>No results for “{typed}”</span>
                </div>
              </CommandEmpty>
            )}
          </CommandList>
          <div className="hidden items-center gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground sm:flex">
            <span>↑↓ to move</span>
            <span>Enter to open</span>
            <span>Esc to close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
