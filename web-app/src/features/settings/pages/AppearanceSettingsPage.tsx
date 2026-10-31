import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useTheme } from '@/hooks/useTheme'
import type { Theme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import { SettingsCard } from '../components/SettingsCard'

const THEME_OPTIONS: {
  value: Theme
  label: string
  description: string
  icon: React.ElementType
}[] = [
  { value: 'light', label: 'Light', description: 'Clean and bright', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes', icon: Moon },
  {
    value: 'system',
    label: 'System',
    description: 'Follows this device',
    icon: Monitor,
  },
]

export function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <DashboardLayout
      title="Appearance"
      subtitle="Only changes this device. Clinic colours and logo are under Branding & theme."
    >
      <SettingsCard title="Mode">
        <div
          role="radiogroup"
          aria-label="Colour mode"
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {THEME_OPTIONS.map((option) => {
            const isActive = theme === option.value
            const Icon = option.icon
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setTheme(option.value)}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
                  isActive
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border bg-surface hover:bg-panel',
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'bg-panel-2 text-text-3',
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-sm font-semibold',
                      isActive ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="block text-xs text-text-3">
                    {option.description}
                  </span>
                </span>
                {isActive && (
                  <Check className="absolute right-3 top-3 size-4 text-primary" />
                )}
              </button>
            )
          })}
        </div>
      </SettingsCard>
    </DashboardLayout>
  )
}
