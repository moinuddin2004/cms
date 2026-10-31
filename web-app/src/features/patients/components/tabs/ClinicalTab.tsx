import { Link } from '@tanstack/react-router'
import { Can } from '@/features/access/components/Can'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingSkeleton } from '@/components/shared'
import { ClipboardList, Plus, ExternalLink, FileText } from 'lucide-react'
import type { Patient } from '../../types'
import {
  PrescriptionStatusBadge,
  usePrescriptionsByPatient,
} from '@/features/prescriptions'

export function ClinicalTab({ patient }: { patient: Patient }) {
  const rxQuery = usePrescriptionsByPatient(patient.id, 1, 20)
  const rxList = rxQuery.data?.data ?? []
  const rxTotal = rxQuery.data?.total ?? 0

  return (
    <div className="space-y-6 mt-4 animate-in fade-in duration-300">
      <Card className="gap-0 py-0 shadow-sm">
        <CardHeader className="border-b px-4 py-3 [.border-b]:pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardList className="text-primary" size={18} />
                Prescriptions
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bilingual builder with templates, doctor signature, and
                printable PDF.
              </p>
            </div>
            <Can perm="prescriptions.create">
              <Button asChild size="sm">
                <Link
                  to={'/prescriptions/new' as any}
                  search={{ patientId: patient.id } as any}
                >
                  <Plus className="size-3.5" /> New prescription
                </Link>
              </Button>
            </Can>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rxQuery.isLoading ? (
            <div className="p-4">
              <LoadingSkeleton variant="table" rows={3} />
            </div>
          ) : rxQuery.isError ? (
            <ErrorState onRetry={() => void rxQuery.refetch()} />
          ) : rxList.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No prescriptions yet"
              description='Click "New prescription" to write one with the full builder.'
            />
          ) : (
            <ul className="divide-y">
              {rxList.map((rx) => (
                <li
                  key={rx.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-md bg-primary-soft text-primary-text flex items-center justify-center shrink-0">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold">
                          {rx.prescriptionNumber}
                        </span>
                        <PrescriptionStatusBadge status={rx.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {new Date(rx.createdAt).toLocaleDateString('en-GB')}
                        {rx.doctor?.fullName && ` · Dr. ${rx.doctor.fullName}`}
                        {' · '}
                        {rx.medicines.length} medicine
                        {rx.medicines.length === 1 ? '' : 's'}
                        {rx.diagnosis ? ` · ${rx.diagnosis}` : ''}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      to={'/prescriptions/$prescriptionId' as any}
                      params={{ prescriptionId: rx.id } as any}
                    >
                      Open <ExternalLink className="size-3" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {rxTotal > rxList.length && (
            <div className="px-4 py-2 text-center border-t text-xs text-muted-foreground">
              Showing {rxList.length} of {rxTotal} —{' '}
              <Link
                to={'/prescriptions' as any}
                search={{ patientId: patient.id } as any}
                className="underline hover:text-foreground"
              >
                view all
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
