import { useState } from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  Droplet,
  FileText,
  Heart,
  IdCard,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  ShieldAlert,
  Tag,
  User,
  UserRound,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAccess } from '@/features/access/hooks/useAccess'
import { cn } from '@/lib/utils'
import type { Patient } from '../../types'
import { useVitals } from '../../hooks/usePatientSubEntities'
import { EditPatientSheet } from '../EditPatientSheet'
import { CHIP_TONES, Chip } from './history/HistoryParts'
import { formatDateTime, formatInClinic } from '@/lib/datetime'

function ageOf(dob: string | null): string | null {
  if (!dob) return null
  const years = Math.floor(
    (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  )
  return `${years} yrs`
}

const pretty = (v: string | null | undefined) =>
  v ? v.replaceAll('_', ' ') : null

export function OverviewTab({ patient }: { patient: Patient }) {
  const access = useAccess()
  const canEdit = access.can('patients.edit')
  const [editOpen, setEditOpen] = useState(false)
  const onAdd = canEdit ? () => setEditOpen(true) : undefined

  const allergies = (patient.allergies ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)

  return (
    <div className="mt-4 space-y-4 animate-in fade-in duration-300">
      <Alerts patient={patient} allergies={allergies} />

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Patient summary</h3>
        {canEdit && (
          <Button size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Edit details
          </Button>
        )}
      </div>

      {/* At a glance */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GlanceTile
          icon={UserRound}
          label="Age · Gender"
          value={
            [ageOf(patient.dob), pretty(patient.gender)]
              .filter(Boolean)
              .join(' · ') || null
          }
        />
        <GlanceTile
          icon={Droplet}
          label="Blood group"
          value={patient.bloodGroup}
        />
        <GlanceTile
          icon={CalendarDays}
          label="Patient since"
          value={formatInClinic(patient.createdAt, 'MMM yyyy')}
        />
        <GlanceTile icon={Tag} label="Source" value={pretty(patient.source)} />
      </div>

      {access.can('patients.clinical.view') && (
        <LatestVitalsStrip patientId={patient.id} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Medical */}
        <InfoCard icon={Heart} iconClass="text-danger" title="Medical">
          <Field label="Allergies">
            {allergies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {allergies.map((a) => (
                  <Chip key={a} className={cn('text-xs', CHIP_TONES.danger)}>
                    <AlertTriangle className="size-3" /> {a}
                  </Chip>
                ))}
              </div>
            ) : (
              <Missing text="No known allergies" onAdd={onAdd} />
            )}
          </Field>
          <Field label="Medical history">
            {patient.medicalHistory ? (
              <p className="whitespace-pre-wrap text-sm">
                {patient.medicalHistory}
              </p>
            ) : (
              <Missing text="Nothing recorded" onAdd={onAdd} />
            )}
          </Field>
        </InfoCard>

        {/* Contact */}
        <InfoCard icon={Phone} title="Contact">
          <ContactRow
            icon={Phone}
            value={patient.phone}
            href={`tel:${patient.phone}`}
          />
          {patient.whatsappNumber && (
            <ContactRow
              icon={MessageCircle}
              value={patient.whatsappNumber}
              hint="WhatsApp"
            />
          )}
          {patient.email && (
            <ContactRow
              icon={Mail}
              value={patient.email}
              href={`mailto:${patient.email}`}
            />
          )}
          {(patient.address || patient.city) && (
            <ContactRow
              icon={MapPin}
              value={[patient.address, patient.city].filter(Boolean).join(', ')}
            />
          )}
          <div className="border-t border-border pt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ShieldAlert className="size-3.5 text-amber" /> Emergency contact
            </p>
            {patient.emergencyContactName ? (
              <div className="rounded-lg bg-panel px-3 py-2">
                <p className="text-sm font-medium">
                  {patient.emergencyContactName}
                  {patient.emergencyContactRelation && (
                    <span className="ml-1.5 text-xs font-normal capitalize text-muted-foreground">
                      ({patient.emergencyContactRelation})
                    </span>
                  )}
                </p>
                {patient.emergencyContactPhone && (
                  <a
                    href={`tel:${patient.emergencyContactPhone}`}
                    className="text-xs text-primary hover:underline"
                  >
                    {patient.emergencyContactPhone}
                  </a>
                )}
              </div>
            ) : (
              <Missing text="None on file" onAdd={onAdd} />
            )}
          </div>
        </InfoCard>

        {/* Profile */}
        <InfoCard
          icon={User}
          title="Profile"
          className="lg:col-span-2 xl:col-span-1"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="CNIC" icon={IdCard}>
              <Value v={patient.cnic} mono />
            </Field>
            <Field label="Marital status">
              <Value v={pretty(patient.maritalStatus)} />
            </Field>
            <Field label="Occupation">
              <Value v={patient.occupation} />
            </Field>
            <Field label="Language">
              <Value v={pretty(patient.preferredLanguage)} />
            </Field>
            {patient.referredByText && (
              <Field label="Referred by" className="col-span-2">
                <Value v={patient.referredByText} />
              </Field>
            )}
          </div>
          <Field label="Tags">
            {patient.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {patient.tags.map((t) => (
                  <Chip key={t} className={cn('text-xs', CHIP_TONES.info)}>
                    {t}
                  </Chip>
                ))}
              </div>
            ) : (
              <Missing text="No tags" onAdd={onAdd} />
            )}
          </Field>
          {patient.internalNotes && (
            <Field label="Internal notes" icon={FileText}>
              <p className="whitespace-pre-wrap rounded-lg border border-amber/30 bg-amber-soft px-3 py-2 text-sm text-foreground">
                {patient.internalNotes}
              </p>
            </Field>
          )}
        </InfoCard>
      </div>

      {canEdit && (
        <EditPatientSheet
          patient={patient}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  )
}

// ─── Alerts ───────────────────────────────────────────────────────────
function Alerts({
  patient,
  allergies,
}: {
  patient: Patient
  allergies: string[]
}) {
  const items: {
    key: string
    icon: LucideIcon
    title: string
    text: string
    tone: string
  }[] = []
  if (allergies.length > 0) {
    items.push({
      key: 'allergy',
      icon: AlertTriangle,
      title: 'Allergies',
      text: allergies.join(', '),
      tone: 'border-danger/30 bg-danger-soft text-danger',
    })
  }
  if (patient.isBlacklisted) {
    items.push({
      key: 'blacklist',
      icon: Ban,
      title: 'Blacklisted',
      text: patient.blacklistReason || 'No reason given',
      tone: 'border-danger/30 bg-danger-soft text-danger',
    })
  }
  if (patient.isMinor) {
    items.push({
      key: 'minor',
      icon: ShieldAlert,
      title: 'Minor — guardian consent needed',
      text:
        [
          patient.guardianName,
          patient.guardianRelation && `(${patient.guardianRelation})`,
          patient.guardianPhone,
        ]
          .filter(Boolean)
          .join(' ') || 'Guardian not recorded',
      tone: 'border-primary/20 bg-primary-soft text-primary-text',
    })
  }
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {items.map((a) => (
        <div
          key={a.key}
          className={cn(
            'flex items-start gap-2.5 rounded-lg border px-3 py-2.5',
            a.tone,
          )}
        >
          <a.icon className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{a.title}</p>
            <p className="text-sm opacity-90">{a.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Latest vitals ────────────────────────────────────────────────────
function LatestVitalsStrip({ patientId }: { patientId: string }) {
  const { data: vitals = [] } = useVitals(patientId)
  const latest = vitals.at(0)
  if (!latest) return null

  const metrics = [
    {
      label: 'BP',
      value:
        latest.bpSystolic || latest.bpDiastolic
          ? `${latest.bpSystolic ?? '–'}/${latest.bpDiastolic ?? '–'}`
          : null,
    },
    { label: 'Pulse', value: latest.pulseRate, unit: 'bpm' },
    { label: 'Temp', value: latest.temperature, unit: '°C' },
    { label: 'SpO₂', value: latest.oxygenSaturation, unit: '%' },
    { label: 'Weight', value: latest.weightKg, unit: 'kg' },
    { label: 'BMI', value: latest.bmi },
  ].filter((m) => m.value !== null && m.value !== '')

  if (metrics.length === 0) return null

  return (
    <Card className="flex-row flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
          <Heart className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Latest vitals</p>
          <p className="text-[11px] text-muted-foreground">
            {formatDateTime(latest.recordedAt)}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-[11px] text-muted-foreground">{m.label}</p>
            <p className="text-base font-semibold tabular-nums">
              {m.value}
              {m.unit && (
                <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                  {m.unit}
                </span>
              )}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ─── Building blocks ──────────────────────────────────────────────────
function GlanceTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string | null | undefined
}) {
  return (
    <Card className="flex-row items-center gap-3 px-3 py-2.5 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-text-2">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          className={cn(
            'truncate text-sm font-semibold capitalize',
            !value && 'font-normal text-muted-foreground',
          )}
        >
          {value || '—'}
        </p>
      </div>
    </Card>
  )
}

function InfoCard({
  icon: Icon,
  iconClass,
  title,
  className,
  children,
}: {
  icon: LucideIcon
  iconClass?: string
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('gap-4 p-4 shadow-sm', className)}>
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={cn('size-4 text-primary', iconClass)} />
        {title}
      </h4>
      {children}
    </Card>
  )
}

function Field({
  label,
  icon: Icon,
  className,
  children,
}: {
  label: string
  icon?: LucideIcon
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3" />}
        {label}
      </p>
      {children}
    </div>
  )
}

function Value({ v, mono }: { v: string | null | undefined; mono?: boolean }) {
  if (!v) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <p
      className={cn(
        'truncate text-sm font-medium capitalize',
        mono && 'font-mono normal-case',
      )}
    >
      {v}
    </p>
  )
}

/** Empty value with an inline "Add" shortcut into the edit sheet. */
function Missing({ text, onAdd }: { text: string; onAdd?: () => void }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="italic">{text}</span>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="text-xs font-medium text-primary hover:underline"
        >
          + Add
        </button>
      )}
    </p>
  )
}

function ContactRow({
  icon: Icon,
  value,
  href,
  hint,
}: {
  icon: LucideIcon
  value: string
  href?: string
  hint?: string
}) {
  const body = (
    <>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{value}</span>
      {hint && (
        <span className="text-[11px] text-muted-foreground">· {hint}</span>
      )}
    </>
  )
  return href ? (
    <a
      href={href}
      className="flex items-center gap-2 text-sm hover:text-primary"
    >
      {body}
    </a>
  ) : (
    <p className="flex items-center gap-2 text-sm">{body}</p>
  )
}
