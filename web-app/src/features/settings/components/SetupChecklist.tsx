import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react'
import { useAccess } from '@/features/access'
import { useAccountSummary, useClinicSetup } from '@/features/account'
import { useCatalogServices } from '@/features/billing'
import { useLabLinks } from '@/features/labs'
import { useOrgTheme } from '@/features/theme'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'

/** done = null while loading. */
type Report = (key: string, done: boolean | null) => void

interface CheckDef {
  key: string
  title: string
  hint: string
  href: string
  /** Renders nothing; reports whether the step is done. */
  Probe: (props: { report: Report }) => null
}

function useReport(report: Report, key: string, done: boolean | null) {
  useEffect(() => {
    report(key, done)
  }, [report, key, done])
}

function ClinicProbe({ report }: { report: Report }) {
  const { data } = useClinicSetup()
  useReport(
    report,
    'clinic',
    data ? !!(data.clinic.phone || data.clinic.email) : null,
  )
  return null
}

function BrandingProbe({ report }: { report: Report }) {
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const { data } = useOrgTheme(orgId)
  const logo = data?.find((k) => k.key === 'logo_url')?.org?.value
  useReport(report, 'branding', data ? !!logo : null)
  return null
}

function ServicesProbe({ report }: { report: Report }) {
  const { data } = useCatalogServices({ activeOnly: true })
  useReport(report, 'services', data ? data.length > 0 : null)
  return null
}

function TeamProbe({ report }: { report: Report }) {
  const { data } = useAccountSummary()
  useReport(report, 'team', data ? data.usage.users > 1 : null)
  return null
}

function LabsProbe({ report }: { report: Report }) {
  const { data } = useLabLinks({ page: 1, limit: 1 })
  useReport(report, 'labs', data ? data.total > 0 : null)
  return null
}

/** Steps a new clinic usually needs once; each shows only to whoever can do it. */
function useChecks(): CheckDef[] {
  const { can, hasFeature, isOwner } = useAccess()
  const checks: (CheckDef | false)[] = [
    isOwner && {
      key: 'clinic',
      title: 'Add your clinic’s contact details',
      hint: 'Phone and email print on invoices and prescriptions.',
      href: '/settings/clinic',
      Probe: ClinicProbe,
    },
    can('admin.theme.manage') && {
      key: 'branding',
      title: 'Upload your logo',
      hint: 'Shown on staff screens, the login page and printouts.',
      href: '/settings/theme',
      Probe: BrandingProbe,
    },
    can('admin.settings.manage') &&
      hasFeature('billing.invoices') && {
        key: 'services',
        title: 'Add your services and prices',
        hint: 'The price list the billing desk charges from.',
        href: '/settings/billing',
        Probe: ServicesProbe,
      },
    isOwner &&
      can('admin.users.manage') && {
        key: 'team',
        title: 'Give your staff their logins',
        hint: 'Each person gets a role that decides what they can see.',
        href: '/settings/users',
        Probe: TeamProbe,
      },
    can('lab.links.manage') && {
      key: 'labs',
      title: 'Connect the labs you work with',
      hint: 'So doctors can send lab orders straight from a visit.',
      href: '/settings/labs',
      Probe: LabsProbe,
    },
  ]
  return checks.filter((c): c is CheckDef => !!c)
}

/**
 * "Finish setting up" card on the settings overview. Hidden once every step
 * the user can do is done.
 */
export function SetupChecklist() {
  const checks = useChecks()
  const [status, setStatus] = useState<Record<string, boolean | null>>({})
  const report = useCallback<Report>(
    (key, done) =>
      setStatus((s) => (s[key] === done ? s : { ...s, [key]: done })),
    [],
  )

  const probes = checks.map(({ key, Probe }) => (
    <Probe key={key} report={report} />
  ))
  if (!checks.length) return null

  const loaded = checks.every((c) => status[c.key] != null)
  const doneCount = checks.filter((c) => status[c.key] === true).length
  if (!loaded || doneCount === checks.length) return <>{probes}</>

  const pct = Math.round((doneCount / checks.length) * 100)

  return (
    <section className="rounded-xl border border-border bg-surface">
      {probes}
      <header className="border-b border-border px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-semibold text-foreground">
            Finish setting up your clinic
          </h2>
          <span className="shrink-0 text-xs font-medium text-text-3">
            {doneCount} of {checks.length} done
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
          className="mt-3 flex gap-1"
        >
          {checks.map((c, i) => (
            <span
              key={c.key}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i < doneCount ? 'bg-primary' : 'bg-panel-2',
              )}
            />
          ))}
        </div>
      </header>
      <ul className="divide-y divide-border">
        {checks.map((c) => {
          const done = status[c.key] === true
          return (
            <li key={c.key}>
              <Link
                to={c.href}
                className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-panel"
              >
                {done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald" />
                ) : (
                  <Circle className="size-5 shrink-0 text-text-3" />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      done ? 'text-text-3 line-through' : 'text-foreground',
                    )}
                  >
                    {c.title}
                  </span>
                  {!done && (
                    <span className="block text-xs text-text-3">{c.hint}</span>
                  )}
                </span>
                {!done && (
                  <ArrowRight className="size-4 shrink-0 text-text-3 transition-transform group-hover:translate-x-0.5" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
