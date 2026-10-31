import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight, SearchX } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { EmptyState } from '@/components/shared'
import { SettingsSearch } from '../components/SettingsSearch'
import { SetupChecklist } from '../components/SetupChecklist'
import { useSettingsItems } from '../hooks/useSettingsItems'

/**
 * `/settings`: what's left to set up, then every settings page by group.
 * On phones this is the settings menu (the rail is desktop-only).
 */
export function SettingsOverviewPage() {
  const [query, setQuery] = useState('')
  const groups = useSettingsItems(query)

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Your account, and how your clinic is set up."
    >
      <div className="space-y-6">
        <SettingsSearch
          value={query}
          onChange={setQuery}
          className="md:hidden"
        />

        {!query && <SetupChecklist />}

        {groups.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No settings match your search"
            description={`Nothing found for “${query}”. Try another word.`}
          />
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
            {groups.map((group) => (
              <section
                key={group.id}
                className="rounded-xl border border-border bg-surface"
              >
                <h2 className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wider text-text-3">
                  {group.label}
                </h2>
                <ul className="divide-y divide-border">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <li key={item.key}>
                        <Link
                          to={item.href}
                          className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-panel"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
                            <Icon className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">
                              {item.label}
                            </span>
                            <span className="block truncate text-xs text-text-3">
                              {item.description}
                            </span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-text-3 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
