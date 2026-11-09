import type { ReactNode } from 'react'
import { BrandMark } from '@/components/layout/BrandMark'
import { useClinicTheme } from '@/features/theme'
import { AuthDayPreview, AuthFeatureList, AuthThemeToggle } from './AuthShared'

/**
 * Immersive brand field with the form as a floating surface. The most
 * expressive of the three; useful when the clinic brand is the hero.
 */
export function AuthStageLayout({ children }: { children: ReactNode }) {
  const { theme } = useClinicTheme()
  const year = new Date().getFullYear()

  return (
    <div className="auth-brand-surface relative min-h-dvh overflow-hidden">
      <div className="auth-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-32 -top-40 size-[560px] rounded-full bg-white/10 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-56 right-[8%] size-[500px] rounded-full bg-black/20 blur-[100px]" />

      <header className="relative z-10 mx-auto flex h-20 max-w-[1280px] items-center justify-between px-6 sm:px-10">
        <BrandMark tone="inverse" />
        <AuthThemeToggle tone="inverse" />
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1280px] items-center gap-10 px-6 pb-12 pt-4 sm:px-10 lg:grid-cols-[minmax(0,1fr)_minmax(380px,430px)] lg:gap-20 lg:pb-24 lg:pt-10">
        <div className="hidden lg:block">
          <div className="flex items-center gap-3">
            <span className="h-px w-7 bg-white/30" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/60">
              Less admin. More care.
            </span>
          </div>

          <h1 className="mt-7 max-w-[620px] font-display text-[64px] leading-[0.98] tracking-[-0.015em] text-white xl:text-[76px]">
            Care first.
            <br />
            <em className="text-white/80">Admin second.</em>
          </h1>
          <p className="mt-6 max-w-[470px] text-[15px] leading-relaxed text-white/75">
            The schedule, the charts, the invoices and the numbers that tell you
            how the week went &mdash; all in one clinic workspace.
          </p>

          <AuthDayPreview className="mt-10 max-w-[470px] -rotate-1" />

          <AuthFeatureList className="mt-8 max-w-[460px]" />
        </div>

        <div className="relative">
          <div className="lg:hidden">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">
              The clinic workspace
            </p>
            <p className="mt-3 font-display text-[38px] leading-[1.02] text-white">
              Care first. <em className="text-white/80">Admin second.</em>
            </p>
          </div>

          <div className="relative mt-8 lg:mt-0">
            <div
              aria-hidden="true"
              className="absolute inset-x-5 -bottom-3 top-5 rotate-[2.5deg] rounded-[30px] bg-white/10"
            />
            <div className="relative rounded-[30px] bg-background p-6 text-foreground shadow-[0_40px_100px_-30px_rgba(0,0,0,0.55)] sm:p-9">
              {children}
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-6 pb-8 text-[11px] text-white/40 sm:px-10">
        <span>
          &copy; {year} {theme.app_name}
        </span>
        <span>Built for multi-location clinics</span>
      </footer>
    </div>
  )
}
