import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useSettingsItems } from '../hooks/useSettingsItems'
import { isSettingsItemActive } from '../lib/settings.registry'
import { SettingsSearch } from './SettingsSearch'

/** Desktop left rail: every settings page the user may open, grouped. */
export function SettingsRail() {
  const [query, setQuery] = useState('')
  const groups = useSettingsItems(query)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav aria-label="Settings" className="space-y-4">
      <SettingsSearch value={query} onChange={setQuery} />
      {groups.length === 0 && (
        <p className="px-3 text-sm text-text-3">No settings match “{query}”.</p>
      )}
      {groups.map((group) => (
        <div key={group.id}>
          <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-3">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              const active = isSettingsItemActive(item, pathname)
              return (
                <li key={item.key}>
                  <Link
                    to={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary-soft text-primary-text'
                        : 'text-text-2 hover:bg-panel hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
