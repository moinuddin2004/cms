import { Moon, Sun } from 'lucide-react'
import { LocationSwitcher } from '@/components/layout/LocationSwitcher'
import { NotificationBell } from '@/features/notifications'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches)

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title="Toggle theme"
      aria-label="Toggle theme"
      className={cn(
        'flex size-[38px] items-center justify-center rounded-[9px] border border-border bg-surface text-text-2 transition-colors hover:bg-panel hover:text-foreground',
      )}
    >
      {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  )
}

export function Topbar() {

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface/80 px-6 backdrop-blur-md">
      {/* Left: workspace identity */}
      <div className="flex items-center gap-2.5">
        {/* <div className="flex size-9 items-center justify-center rounded-[10px] bg-primary-soft text-primary-text">
          <Building2 className="size-[18px]" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-tight text-foreground">
            {activeOrg?.name || 'Workspace'}
          </span>
          <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-3">
            Workspace
          </span>
        </div> */}
      </div>

      {/* Right: notifications + theme + location */}
      <div className="flex items-center gap-2.5">
        <NotificationBell />
        <ThemeToggle />
        <LocationSwitcher />
      </div>
    </header>
  )
}
