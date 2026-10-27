import { useEffect, useState } from 'react'
import { CalendarDays, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  /** `inverse` sits on the brand surface. */
  tone?: 'default' | 'inverse'
  className?: string
}

/** Light/dark switch that follows the *resolved* mode, not the stored preference. */
export function AuthThemeToggle({
  tone = 'default',
  className,
}: ThemeToggleProps) {
  const { setTheme } = useTheme()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2',
        tone === 'inverse'
          ? 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white focus-visible:ring-white/30'
          : 'border-border/70 bg-surface/60 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-primary/30',
        className,
      )}
    >
      {isDark ? (
        <Sun className="size-[17px]" />
      ) : (
        <Moon className="size-[17px]" />
      )}
    </button>
  )
}

const SAMPLE_DAY = [
  { time: '09:00', title: 'New patient visit', meta: '30 min · Room 2' },
  { time: '10:15', title: 'Follow-up', meta: '15 min · Room 1' },
  { time: '11:00', title: 'Lab results review', meta: '10 min · Virtual' },
]

/**
 * Illustrative day view on the brand surface. The product's world is the
 * clinic day, so this is the one memorable object in the layout.
 */
export function AuthDayPreview({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] shadow-[0_30px_70px_-40px_rgba(0,0,0,0.75)] backdrop-blur-md',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80">
            <CalendarDays className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium leading-none text-white">
              Today&rsquo;s schedule
            </p>
            <p className="mt-1 text-[10.5px] leading-none text-white/45">
              9 appointments
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-2 py-1 text-[10px] font-medium text-white/70">
          <span className="size-1.5 rounded-full bg-white/80" />
          On track
        </span>
      </div>
      <div className="px-4 py-1">
        {SAMPLE_DAY.map((row, index) => (
          <div
            key={row.time}
            className={cn(
              'grid grid-cols-[44px_1fr_auto] items-center gap-3 py-2.5',
              index > 0 && 'border-t border-white/10',
            )}
          >
            <span className="font-mono text-[11px] tabular-nums text-white/45">
              {row.time}
            </span>
            <span className="truncate text-[12.5px] font-medium text-white/90">
              {row.title}
            </span>
            <span className="text-[10.5px] text-white/45">{row.meta}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Slow ECG trace — a quiet nod to the clinical setting. */
export function AuthPulse({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('relative', className)}>
      <svg
        viewBox="0 0 420 64"
        fill="none"
        preserveAspectRatio="none"
        className="h-12 w-full text-white/40"
      >
        <path
          className="auth-pulse"
          d="M0 36h72l10-16 14 34 16-46 14 38 10-10h34l8-14 12 28 14-40 14 34 8-8h164"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
        />
      </svg>
    </div>
  )
}

const FEATURES = [
  'Scheduling',
  'Patient records',
  'Billing',
  'Lab orders',
  'Reports',
]

/** What the product does, in the order a clinic day touches it. */
export function AuthFeatureList({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        'flex flex-wrap gap-x-5 gap-y-2.5 text-[12px] text-white/60',
        className,
      )}
    >
      {FEATURES.map((feature) => (
        <li key={feature} className="flex items-center gap-2">
          <span className="size-1 rounded-full bg-white/40" />
          {feature}
        </li>
      ))}
    </ul>
  )
}
