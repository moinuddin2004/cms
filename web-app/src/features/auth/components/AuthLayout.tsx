import type { ReactNode } from 'react'
import { Activity, CalendarDays, Shield } from 'lucide-react'

interface AuthLayoutProps {
  children: ReactNode
}

/**
 * Split-screen auth layout matching MedTrackr design.
 *
 * – Left panel: gradient brand area with logo, tagline, feature bullets, copyright.
 * – Right panel: clean form area (receives `children`).
 * – Responsive: brand panel hides below `lg` (1024 px).
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen h-screen">
      {/* ──────────────── Form panel ──────────────── */}
      <div className="flex-1 min-w-0 bg-white dark:bg-slate-950 flex items-center justify-center px-6 py-10 overflow-y-auto">
        <div className="w-full max-w-[380px] animate-in slide-in-from-bottom-2 fade-in duration-200">
          {children}
        </div>
      </div>
      {/* ──────────────── Brand panel ──────────────── */}
      <div className="hidden lg:flex flex-1 min-w-0 relative overflow-hidden flex-col text-white p-[52px]"
        style={{ background: 'linear-gradient(155deg, #1d4ed8 0%, #2563eb 48%, #059669 125%)' }}
      >
        {/* Dot-grid overlay */}
        <div
          className="absolute inset-0 opacity-45 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,.12) 1px, transparent 0)',
            backgroundSize: '26px 26px',
          }}
        />
        {/* Decorative circles */}
        <div className="absolute w-[460px] h-[460px] rounded-full bg-white/[.07] -top-[140px] -right-[140px]" />
        <div className="absolute w-[300px] h-[300px] rounded-full bg-white/[.06] -bottom-[100px] -left-[80px]" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-[11px] bg-white/20 flex items-center justify-center">
            <Activity className="w-[22px] h-[22px] text-white" strokeWidth={2.4} />
          </div>
          <span className="text-xl font-extrabold tracking-tight">MedTrackr</span>
        </div>

        {/* Tagline & features — pushed to bottom */}
        <div className="relative mt-auto">
          <h1 className="text-4xl font-extrabold tracking-tight leading-[1.12] max-w-[440px]">
            The calm, modern way to run your clinic.
          </h1>
          <p className="text-[15px] text-white/85 mt-[18px] mb-8 max-w-[410px] leading-relaxed">
            Patients, appointments, billing and inventory — unified in one
            premium workspace your whole team will love.
          </p>

          <div className="flex flex-col gap-4 max-w-[400px]">
            <Feature icon={<CalendarDays className="w-[18px] h-[18px] text-white" />}>
              Smart scheduling with live queue &amp; calendar
            </Feature>
            <Feature icon={<Activity className="w-[18px] h-[18px] text-white" />}>
              Real-time revenue, billing &amp; expense insights
            </Feature>
            <Feature icon={<Shield className="w-[18px] h-[18px] text-white" />}>
              HIPAA-minded security &amp; role-based access
            </Feature>
          </div>
        </div>

        {/* Copyright */}
        <div className="relative mt-12 text-xs text-white/70">
          · Privacy Policy · Terms of Service
        </div>
      </div>

    
    </div>
  )
}

/* ── Feature row ─────────────────────────────────── */
function Feature({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-[13px]">
      <span className="w-9 h-9 rounded-[10px] bg-white/[.16] flex items-center justify-center shrink-0">
        {icon}
      </span>
      <span className="text-[14.5px] font-medium text-white/95">{children}</span>
    </div>
  )
}
