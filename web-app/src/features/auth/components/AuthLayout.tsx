import type { ReactNode } from 'react'
import { Activity, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex min-h-screen h-screen">
      {/* ──────────────── Form panel ──────────────── */}
      <div className="flex-1 min-w-0 bg-white dark:bg-slate-950 flex flex-col overflow-y-auto">
        {/* Theme toggle top-right of form panel */}
        <div className="flex justify-end px-6 pt-5">
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

      {/* ──────────────── Brand panel ──────────────── */}
      <div
        className="hidden lg:flex flex-1 min-w-0 relative overflow-hidden flex-col text-white p-[52px]"
        style={{ background: 'linear-gradient(150deg, #0f172a 0%, #1e3a5f 55%, #0e4f6b 100%)' }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Glow orbs */}
        <div className="absolute w-[500px] h-[500px] rounded-full -top-[180px] -right-[160px]"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,.18) 0%, transparent 70%)' }} />
        <div className="absolute w-[360px] h-[360px] rounded-full -bottom-[120px] -left-[100px]"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,.14) 0%, transparent 70%)' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-[11px] bg-white/10 border border-white/20 flex items-center justify-center">
            <Activity className="w-[20px] h-[20px] text-white" strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold tracking-tight text-white/90">MedTrackr</span>
        </div>

        {/* Main content */}
        <div className="relative mt-auto">
      

          <h1 className="text-[38px] font-extrabold tracking-tight leading-[1.1] max-w-[420px] text-white">
            One platform.<br />Every workflow.
          </h1>
          <p className="text-[15px] text-white/55 mt-4 max-w-[380px] leading-relaxed">
            Purpose-built for multi-location clinics — from scheduling and billing to staff management and compliance.
          </p>

          {/* Stats row */}
          <div className="flex gap-8 mt-10">
            <Stat value="99.9%" label="Uptime SLA" />
            <Stat value="SOC 2" label="Type II Certified" />
            <Stat value="HIPAA" label="Compliant" />
          </div>
        </div>

        {/* Footer */}
        <div className="relative mt-12 flex items-center gap-4 text-xs text-white/30">
          <span>Privacy Policy</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>Terms of Service</span>
          <span className="w-1 h-1 rounded-full bg-white/20" />
          <span>© 2025 MedTrackr</span>
        </div>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/45 mt-0.5">{label}</div>
    </div>
  )
}
