import type { ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { BrandMark } from '@/components/layout/BrandMark'
import { useTheme } from '@/hooks/useTheme'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { theme, setTheme } = useTheme()

  return (
    <div className="relative flex min-h-screen h-screen overflow-hidden bg-white dark:bg-slate-950">
      {/* ──────────────── Brand backdrop ──────────────── */}
      {/* Clinic brand colour (theme → --primary) on the right, masked so it fades into the
          page background behind the form instead of meeting it at a hard edge. */}
      <div className="hidden lg:block absolute inset-y-0 right-0 w-[64%] pointer-events-none bg-primary [mask-image:linear-gradient(to_right,transparent,black_38%)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_38%)]">
        {/* Depth over the brand colour */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-black/20 to-black/45" />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
        {/* Glow orbs */}
        <div className="absolute w-[520px] h-[520px] rounded-full -top-[180px] -right-[160px] bg-white/10 blur-3xl" />
        <div className="absolute w-[420px] h-[420px] rounded-full -bottom-[160px] left-[30%] bg-white/10 blur-3xl" />
      </div>
      {/* Soft brand glow behind the form ties both sides together */}
      <div className="absolute w-[520px] h-[520px] rounded-full top-1/2 -translate-y-1/2 -left-[200px] bg-primary/10 dark:bg-primary/15 blur-3xl pointer-events-none" />

      {/* ──────────────── Form panel ──────────────── */}
      <div className="relative flex-1 min-w-0 flex flex-col overflow-y-auto">
        {/* Clinic brand (small screens, where the brand panel is hidden) + theme toggle */}
        <div className="flex items-center justify-between px-6 pt-5 lg:justify-end">
          <BrandMark className="lg:hidden" />
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-[18px] h-[18px]" />
            ) : (
              <Moon className="w-[18px] h-[18px]" />
            )}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 py-6">
          <div className="w-full max-w-[380px] animate-in slide-in-from-bottom-2 fade-in duration-200">
            {children}
          </div>
        </div>
      </div>

      {/* ──────────────── Brand content (over the solid part of the backdrop) ──────────────── */}
      <div className="hidden lg:flex relative w-[40%] min-w-0 flex-col text-white p-[52px]">
        {/* Logo */}
        <div className="relative">
          <BrandMark tone="inverse" />
        </div>

        {/* Main content */}
        <div className="relative mt-auto">
          <h1 className="text-[38px] font-extrabold tracking-tight leading-[1.1] max-w-[420px] text-white">
            One platform.<br />Every workflow.
          </h1>
          <p className="text-[15px] text-white/55 mt-4 max-w-[380px] leading-relaxed">
            Purpose-built for multi-location clinics — from scheduling and billing to staff management and reporting.
          </p>
        </div>

        {/* Footer */}
        <div className="relative mt-12 text-xs text-white/30">
          © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
