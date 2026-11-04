import type { ReactNode } from 'react'
import { BrandMark } from '@/components/layout/BrandMark'
import { useClinicTheme } from '@/features/theme'
import {
  AuthDayPreview,
  AuthFeatureList,
  AuthThemeToggle,
} from './AuthShared'

/**
 * Split workspace: the form keeps a calm, plain surface; the brand panel
 * holds the product story. Crisp seam instead of a masked gradient.
 */
export function AuthSplitLayout({ children }: { children: ReactNode }) {
  const { theme } = useClinicTheme()
  const year = new Date().getFullYear()

  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
      <div className="flex min-h-dvh flex-col px-6 sm:px-10 lg:px-12 xl:px-16">
        <header className="flex h-16 shrink-0 items-center justify-between">
          <BrandMark />
          <AuthThemeToggle />
        </header>

        <main className="flex flex-1 items-center py-4">
          <div className="mx-auto w-full max-w-[400px] animate-in fade-in slide-in-from-bottom-2 duration-300">
            {children}
          </div>
        </main>

        <footer className="flex shrink-0 items-center justify-between gap-6 pb-5 text-[11px] text-muted-foreground/70">
          <span>
            &copy; {year} {theme.app_name}
          </span>
          <span className="hidden sm:inline">
            Scheduling &middot; Patients &middot; Billing
          </span>
        </footer>
      </div>

      <div className="relative hidden p-3 pl-0 lg:block">
        <aside className="auth-brand-surface sticky top-3 flex h-[calc(100dvh-24px)] flex-col overflow-hidden rounded-[30px] p-9 xl:p-12">
          <div className="auth-grid pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute -left-24 -top-32 size-[420px] rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <span className="h-px w-7 bg-white/30" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/60">
              The clinic workspace
            </span>
          </div>

          <div className="relative my-auto py-10">
            <h1 className="max-w-[440px] font-display text-[46px] leading-[1.02] tracking-[-0.01em] text-white xl:text-[54px]">
              Every clinic day,
              <br />
              <em className="text-white/85">in one calm place.</em>
            </h1>
            <p className="mt-5 max-w-[370px] text-[14px] leading-relaxed text-white/75">
              Appointments, patient records, billing and reports, connected
              &mdash; so your team spends less time on admin and more on care.
            </p>

            <AuthDayPreview className="mt-9 max-w-[430px]" />
          </div>

          <div className="relative flex items-end justify-between gap-6">
            <AuthFeatureList className="max-w-[290px]" />
            <span className="shrink-0 font-display text-[22px] leading-none text-white/25">
              {year}
            </span>
          </div>
        </aside>
      </div>
    </div>
  )
}
