import { useState } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  FileBarChart,
  FlaskConical,
  PhoneCall,
  UserMinus,
  UserX,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState, PageWrapper } from '@/components/shared'
import { Segmented } from '@/features/billing'
import { cn } from '@/lib/utils'
import {
  AttentionList,
  BarList,
  DashCard,
  KpiTile,
  StackedBar,
  absoluteChange,
  percentChange,
} from '../components/finance-cards'
import type { AttentionItem, Tone } from '../components/finance-cards'
import { BusiestTimes } from '../components/BusiestTimes'
import { ClinicTrendChart } from '../components/ClinicTrendChart'
import { ReportFilters } from '../components/ReportFilters'
import { useClinicOverview, useReportQuery } from '../hooks/use-reports'
import { periodLabel } from '../lib/report-format'
import type { ClinicOverview, CountItem } from '../types/reports.types'

const count = (n: number) => n.toLocaleString('en-PK')
const minutes = (n: number | null) => (n == null ? '—' : `${n} min`)
const bars = (items: CountItem[]) =>
  items.map((i) => ({ label: i.label, amount: i.count }))

const OUTCOME_TONE: Record<string, Tone> = {
  completed: 'emerald',
  checked_in: 'primary',
  pending: 'neutral',
  cancelled: 'amber',
  no_show: 'danger',
}

/** Waiting time chip: under 15 min fine, under 30 slow, longer too long. */
function WaitChip({ min }: { min: number | null }) {
  if (min == null) return <span className="text-text-3">—</span>
  const tone =
    min < 15
      ? 'bg-emerald-soft text-emerald'
      : min < 30
        ? 'bg-amber-soft text-amber'
        : 'bg-danger-soft text-danger'
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        tone,
      )}
    >
      {Math.round(min)} min
    </span>
  )
}

function DoctorTable({ doctors }: { doctors: ClinicOverview['doctors'] }) {
  if (!doctors.length) {
    return (
      <p className="py-6 text-center text-sm text-text-3">
        No visits in this period.
      </p>
    )
  }
  const max = Math.max(...doctors.map((d) => d.visits), 1)
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] font-medium text-text-3">
          <th className="pb-2 font-medium">Doctor</th>
          <th className="pb-2 text-right font-medium">Visits</th>
          <th className="pb-2 text-right font-medium">Patients</th>
          <th className="pb-2 text-right font-medium">Avg wait</th>
          <th className="pb-2 text-right font-medium">Consult</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border-soft">
        {doctors.map((d) => (
          <tr key={d.doctorId ?? d.name}>
            <td className="py-2.5 pr-3">
              <p className="font-medium">
                {d.doctorId ? `Dr. ${d.name}` : d.name}
              </p>
              <div className="mt-1 h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-panel">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(d.visits / max) * 100}%` }}
                />
              </div>
            </td>
            <td className="py-2.5 text-right font-semibold tabular-nums">
              {d.visits}
            </td>
            <td className="py-2.5 text-right tabular-nums text-text-2">
              {d.patients}
            </td>
            <td className="py-2.5 text-right">
              <WaitChip min={d.avgWaitMin} />
            </td>
            <td className="py-2.5 text-right tabular-nums text-text-2">
              {minutes(d.avgConsultMin)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

type MixTab = 'source' | 'gender' | 'age'

/** Source / gender / age of patients, with a note when profiles are incomplete. */
function PatientMix({ d }: { d: ClinicOverview }) {
  const [tab, setTab] = useState<MixTab>('source')
  const items =
    tab === 'source'
      ? d.sources
      : tab === 'gender'
        ? d.demographics.gender
        : d.demographics.age
  const recorded = items.filter((i) => i.label !== 'Not recorded')
  const missing = items.find((i) => i.label === 'Not recorded')?.count ?? 0
  const total = items.reduce((a, i) => a + i.count, 0)
  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'source', label: 'Source' },
          { value: 'gender', label: 'Gender' },
          { value: 'age', label: 'Age' },
        ]}
      />
      <BarList
        items={bars(recorded)}
        format={count}
        showShare={tab !== 'age'}
        empty={
          tab === 'source'
            ? 'No new patients in this period.'
            : 'Not recorded for these patients.'
        }
      />
      {missing > 0 && (
        <p className="flex items-start gap-2 text-xs text-amber">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          {missing} of {total} patients have no {tab} recorded — complete their
          profiles for a true picture.
        </p>
      )}
    </div>
  )
}

/** Top diagnoses / treatments, one list at a time. */
function WhatWeTreat({ d }: { d: ClinicOverview }) {
  const [tab, setTab] = useState<'diagnoses' | 'treatments'>('diagnoses')
  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'diagnoses', label: 'Diagnoses' },
          { value: 'treatments', label: 'Treatments' },
        ]}
      />
      <BarList
        items={bars(tab === 'diagnoses' ? d.topDiagnoses : d.topTreatments)}
        format={count}
        showShare={false}
        empty={
          tab === 'diagnoses'
            ? 'No diagnoses recorded in this period.'
            : 'No treatments recorded in this period.'
        }
      />
    </div>
  )
}

/**
 * The owner's "how is the clinic running" screen: four headline numbers,
 * what needs a phone call, how visits and appointments went, doctors and
 * who the patients are.
 */
export function ClinicOverviewPage() {
  const query = useReportQuery('reports.clinical.view')
  const overview = useClinicOverview({ ...query, basis: undefined })
  const d = overview.data

  return (
    <div className="space-y-4">
      <PageWrapper
        title="Clinic overview"
        subtitle={
          d
            ? `${d.scope.label} · ${periodLabel(d.period.from, d.period.to)} · compared with ${periodLabel(d.previousPeriod.from, d.previousPeriod.to)}`
            : 'Patients, appointments and waiting for your clinic'
        }
        actions={
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/reports">
              <FileBarChart className="size-4" />
              All reports
            </Link>
          </Button>
        }
      />

      <ReportFilters
        reach="reports.clinical.view"
        fetching={overview.isFetching && !overview.isLoading}
      />

      {overview.isError ? (
        <ErrorState
          title="Couldn't load the clinic overview"
          onRetry={() => void overview.refetch()}
        />
      ) : !d ? (
        <OverviewSkeleton />
      ) : (
        <ClinicDashboard d={d} />
      )}
    </div>
  )
}

function ClinicDashboard({ d }: { d: ClinicOverview }) {
  const { kpis, trend } = d
  const attention: AttentionItem[] = [
    {
      key: 'missed',
      label: 'Missed follow-ups (last 30 days)',
      value: d.attention.missedFollowUps,
      icon: PhoneCall,
      tone: 'danger',
      report: 'follow-ups',
    },
    {
      key: 'noshow',
      label: 'No-shows to call back',
      value: d.attention.noShowsToCall,
      icon: UserX,
      tone: 'danger',
      report: 'no-shows',
    },
    {
      key: 'upcoming',
      label: 'Follow-ups due this week',
      value: d.attention.upcomingFollowUps,
      icon: CalendarClock,
      tone: 'primary',
      report: 'follow-ups',
    },
    {
      key: 'lapsed',
      label: 'Patients who stopped coming',
      value: d.attention.lapsedPatients,
      icon: UserMinus,
      tone: 'amber',
      report: 'lapsed-patients',
    },
    {
      key: 'lab',
      label: 'Late lab orders',
      value: d.attention.lateLabOrders,
      icon: FlaskConical,
      tone: 'amber',
      report: 'lab-delays',
    },
  ]
  const returning =
    (kpis.visits.value ?? 0) - trend.points.reduce((a, p) => a + p.newVisits, 0)
  const booked = d.appointmentStatus.reduce((a, s) => a + s.count, 0)

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Patients seen"
          value={count(kpis.patientsSeen.value ?? 0)}
          change={percentChange(kpis.patientsSeen.changePct)}
          hint={`${count(kpis.visits.value ?? 0)} visits · ${count(Math.max(returning, 0))} returning`}
          trend={trend.points.map((p) => p.visits)}
        />
        <KpiTile
          label="New patients"
          value={count(kpis.newPatients.value ?? 0)}
          change={percentChange(kpis.newPatients.changePct)}
          hint={`${kpis.walkInPct.value ?? 0}% of arrivals walk in`}
          trend={trend.points.map((p) => p.newPatients)}
        />
        <KpiTile
          label="Show-up rate"
          value={
            kpis.showUpPct.value == null ? '—' : `${kpis.showUpPct.value}%`
          }
          change={absoluteChange(
            kpis.showUpPct.value,
            kpis.showUpPct.previous,
            'pts',
          )}
          hint={`${count(kpis.appointments.value ?? 0)} appointments booked`}
          trend={trend.points.map((p) => p.showUpPct)}
        />
        <KpiTile
          label="Average wait"
          value={minutes(kpis.avgWaitMin.value)}
          change={absoluteChange(
            kpis.avgWaitMin.value,
            kpis.avgWaitMin.previous,
            'min',
            false,
          )}
          hint={`Consultation ${minutes(kpis.avgConsultMin.value)}`}
          trend={trend.points.map((p) => p.avgWaitMin)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <DashCard
          title={`Visits per ${trend.unit}`}
          subtitle="Returning patients and first visits"
          link={{ report: 'appointments-daily', label: 'By day' }}
        >
          <ClinicTrendChart data={trend.points} />
        </DashCard>
        <DashCard
          title="Needs attention"
          subtitle="Lists to work through today"
        >
          <AttentionList items={attention} />
        </DashCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashCard
          title="Appointment outcomes"
          subtitle={`${count(booked)} booked for this period`}
          link={{ report: 'no-shows', label: 'No-shows' }}
        >
          <StackedBar
            segments={d.appointmentStatus.map((s) => ({
              key: s.key,
              label: s.label,
              value: s.count,
              tone: OUTCOME_TONE[s.key] ?? 'neutral',
            }))}
            empty="No appointments in this period."
          />
        </DashCard>
        <DashCard
          title="Busiest times"
          subtitle="Check-ins by weekday"
          link={{ report: 'busy-hours', label: 'By hour' }}
        >
          <BusiestTimes cells={d.heatmap} />
        </DashCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr]">
        <DashCard
          title="Doctors"
          subtitle="Visits and how long their patients wait"
          link={{ report: 'queue-by-doctor', label: 'Waiting times' }}
          className="lg:col-span-2 xl:col-span-1"
        >
          <DoctorTable doctors={d.doctors} />
        </DashCard>
        <DashCard
          title="Patient mix"
          subtitle="Who your patients are"
          link={{ report: 'patient-demographics', label: 'Details' }}
        >
          <PatientMix d={d} />
        </DashCard>
        <DashCard
          title="What we treat"
          subtitle="Most common in this period"
          link={{ report: 'diagnoses', label: 'All' }}
        >
          <WhatWeTreat d={d} />
        </DashCard>
      </div>
    </>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-[330px] rounded-xl" />
        <Skeleton className="h-[330px] rounded-xl" />
      </div>
    </div>
  )
}
