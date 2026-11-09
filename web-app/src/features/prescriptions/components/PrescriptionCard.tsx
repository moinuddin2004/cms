import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { CalendarDays, ChevronRight, FileText, Stethoscope } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { InitialsAvatar } from '@/components/shared'
import type { Prescription } from '../types'
import { PrescriptionStatusBadge } from './PrescriptionStatusBadge'
import { MedicineChips } from './MedicineChips'
import { formatInClinic } from '@/lib/datetime'

export function PrescriptionCard({
  prescription: rx,
}: {
  prescription: Prescription
}) {
  const patientName = rx.patient?.fullName ?? 'Unknown patient'
  const created = new Date(rx.createdAt)

  return (
    <Link
      to={'/prescriptions/$prescriptionId' as any}
      params={{ prescriptionId: rx.id } as any}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="relative h-full overflow-hidden border border-border bg-card py-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/5">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        <CardContent className="flex h-full flex-col gap-4 p-5">
          {/* Rx number + status */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-text-3">
              <FileText className="size-3.5 text-primary-text" />
              {rx.prescriptionNumber}
            </span>
            <PrescriptionStatusBadge status={rx.status} />
          </div>

          {/* Patient */}
          <div className="flex items-center gap-3">
            <InitialsAvatar name={patientName} seed={rx.patientId} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                {patientName}
              </p>
              {rx.patient?.patientNumber && (
                <p className="font-mono text-[11px] text-text-3">
                  {rx.patient.patientNumber}
                </p>
              )}
            </div>
          </div>

          {/* Diagnosis */}
          {rx.diagnosis && (
            <p className="line-clamp-2 rounded-lg bg-panel-2 px-3 py-2 text-xs text-text-2">
              <span className="font-semibold text-foreground">Dx: </span>
              {rx.diagnosis}
            </p>
          )}

          <MedicineChips medicines={rx.medicines} max={3} />

          {/* Footer */}
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-[11px] text-text-3">
            <div className="flex min-w-0 flex-col gap-1">
              {rx.doctor?.fullName && (
                <span className="flex items-center gap-1.5 truncate">
                  <Stethoscope className="size-3 shrink-0 text-emerald" />
                  Dr. {rx.doctor.fullName}
                </span>
              )}
              <span
                className="flex items-center gap-1.5"
                title={formatInClinic(created, 'dd MMM yyyy, hh:mm a')}
              >
                <CalendarDays className="size-3 shrink-0" />
                {formatDistanceToNow(created, { addSuffix: true })}
              </span>
            </div>
            <ChevronRight className="size-4 shrink-0 text-text-3 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
