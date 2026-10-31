import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  LayoutDashboard,
  Moon,
  Receipt,
  Sun,
  Users,
} from 'lucide-react'
import { BrandMark } from '@/components/layout/BrandMark'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import { buildThemeCss } from '../lib/apply-theme'
import { isHexColor } from '../lib/color'
import type { ThemeFormValues } from '../schemas/theme.schema'
import { DEFAULT_THEME } from '../types'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Appointments', icon: CalendarDays, active: true },
  { label: 'Patients', icon: Users },
  { label: 'Billing', icon: Receipt },
]

/**
 * Live preview of unsaved theme values: a scoped copy of the brand tokens
 * (so the rest of the page keeps the saved theme) over a sample sidebar,
 * buttons, a card and an invoice header.
 */
export function ThemePreview({
  values,
  inherited,
}: {
  values: ThemeFormValues['values']
  /** What empty fields fall back to (shown as such). */
  inherited?: Partial<
    Pick<ThemeFormValues['values'], 'app_name' | 'logo_url' | 'logo_dark_url'>
  >
}) {
  const scope = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [dark, setDark] = useState(false)
  // Picking a dark base shows it straight away.
  const lastDarkBase = useRef(values.dark_base)
  useEffect(() => {
    if (lastDarkBase.current === values.dark_base) return
    lastDarkBase.current = values.dark_base
    setDark(true)
  }, [values.dark_base])
  const brand = isHexColor(values.brand_color)
    ? values.brand_color
    : DEFAULT_THEME.brand_color
  const css = useMemo(
    () =>
      buildThemeCss(brand, values.dark_base, {
        light: `[data-theme-preview='${scope}']`,
        dark: `.dark [data-theme-preview='${scope}'], [data-theme-preview='${scope}'].dark`,
      }),
    [brand, values.dark_base, scope],
  )
  const mark = {
    app_name: values.app_name || inherited?.app_name || DEFAULT_THEME.app_name,
    logo_url: values.logo_url || inherited?.logo_url || null,
    logo_dark_url: values.logo_dark_url || inherited?.logo_dark_url || null,
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Live preview</h3>
        <TooltipButton
          type="button"
          variant="ghost"
          size="icon"
          tooltip={dark ? 'Preview light mode' : 'Preview dark mode'}
          onClick={() => setDark((d) => !d)}
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </TooltipButton>
      </div>
      <style>{css}</style>
      <div
        data-theme-preview={scope}
        className={cn(
          'flex overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-sm',
          dark && 'dark',
        )}
      >
        {/* Sample sidebar */}
        <div
          data-sidebar-preview={values.sidebar_style}
          className="flex w-44 shrink-0 flex-col border-r border-sidebar-border bg-sidebar"
        >
          <div className="flex h-14 items-center border-b border-border px-3">
            <BrandMark theme={mark} className="[&_span]:text-sm" />
          </div>
          <nav className="space-y-0.5 p-2" aria-label="Preview navigation">
            {NAV.map(({ label, icon: Icon, active }) => (
              <div
                key={label}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium',
                  active
                    ? 'bg-primary-soft font-semibold text-primary-text'
                    : 'text-text-2',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </div>
            ))}
          </nav>
        </div>

        {/* Sample page */}
        <div className="min-w-0 flex-1 space-y-4 bg-muted/30 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" type="button">
              New appointment
            </Button>
            <Button size="sm" variant="outline" type="button">
              Export
            </Button>
            <span className="text-sm font-medium text-primary-text underline underline-offset-2">
              View all
            </span>
          </div>

          <Card className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardTitle className="text-sm">Today&apos;s patients</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between px-4">
              <span className="text-2xl font-bold text-foreground">24</span>
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-text">
                +12%
              </span>
            </CardContent>
          </Card>

          {/* Invoice header (print) */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3 border-b-2 border-primary pb-3">
              <BrandMark theme={mark} className="[&_span]:text-base" />
              <div className="text-right">
                <div className="text-sm font-bold tracking-wide text-primary-text">
                  INVOICE
                </div>
                <div className="text-xs text-muted-foreground">INV-000123</div>
              </div>
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Bill to: Ayesha Khan</span>
              <span className="font-semibold text-foreground">Rs 4,500</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
