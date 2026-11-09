import type { ReactNode } from 'react'
import { BrandMark } from '@/components/layout/BrandMark'
import { useClinicTheme } from '@/features/theme'
import { AuthFeatureList, AuthPulse, AuthThemeToggle } from './AuthShared'

/**
 * Focused card: a single framed object on an ambient field. The brand half
 * carries a short statement; the form half stays quiet.
 */
export function AuthPanelLayout({ children }: { children: ReactNode }) {
  const { theme } = useClinicTheme()
  const year = new Date().getFullYear()

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-muted/40 px-4 py-8 sm:px-6 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-52 size-[640px] rounded-full bg-primary/10 blur-[110px]" />
        <div className="absolute -bottom-64 -right-32 size-[560px] rounded-full bg-primary/[0.07] blur-[100px]" />
        <div className="auth-ambient absolute inset-0" />
      </div>

      <div className="relative w-full max-w-[980px] overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_40px_120px_-50px_rgba(15,23,42,0.45)] lg:grid lg:grid-cols-[0.86fr_1.14fr]">
        <aside className="auth-brand-surface relative hidden overflow-hidden p-10 lg:flex lg:flex-col xl:p-12">
          <div className="auth-grid pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute -right-24 -top-24 size-[320px] rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <span className="h-px w-7 bg-white/30" />
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/60">
              A calmer front desk
            </span>
          </div>

          <div className="relative my-auto py-10">
            <h1 className="max-w-[380px] font-display text-[40px] leading-[1.05] tracking-[-0.01em] text-white xl:text-[44px]">
              Built for the way clinics{' '}
              <em className="text-white/85">actually run.</em>
            </h1>
            <p className="mt-5 max-w-[340px] text-[13.5px] leading-relaxed text-white/75">
              One place for the front desk, the treatment room and the back
              office.
            </p>

            <AuthPulse className="mt-9" />
            <AuthFeatureList className="mt-6" />
          </div>

          <div className="relative flex items-center justify-between gap-4 text-[11px] text-white/40">
            <span>Every location. One system.</span>
            <span>{year}</span>
          </div>
        </aside>

        <section className="flex flex-col bg-card px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <div className="mb-8 flex items-center justify-between gap-4 lg:justify-end">
            <BrandMark className="lg:hidden" />
            <AuthThemeToggle />
          </div>

          <div className="flex flex-1 flex-col justify-center">
            <div className="w-full max-w-[380px] self-center">{children}</div>
          </div>

          <p className="mt-8 text-center text-[11px] text-muted-foreground/70">
            &copy; {year} {theme.app_name}
          </p>
        </section>
      </div>
    </div>
  )
}
