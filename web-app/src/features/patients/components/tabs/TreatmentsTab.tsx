import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Can } from '@/features/access/components/Can'
import { Badge } from '@/components/ui/badge'
import { Loader2, Stethoscope, Banknote, Link2, FileText } from 'lucide-react'
import { usePatientTreatments } from '../../hooks/usePatientSubEntities'
import type { Patient } from '../../types'
import { TreatmentFormDialog } from './TreatmentFormDialog'
import { VisitDetailSheet } from './history/VisitDetailSheet'
import { formatYmd } from '@/lib/datetime'

const num = (v: number | string | null | undefined) =>
  v == null ? 0 : typeof v === 'string' ? parseFloat(v) || 0 : v

export function TreatmentsTab({
  patient,
  hideAmounts = false,
}: {
  patient: Patient
  /** Clinical-only view (doctor's consultation): no fees, no fee entry. */
  hideAmounts?: boolean
}) {
  const { data: treatments = [], isLoading } = usePatientTreatments(patient.id)
  // The visit a treatment was done in, opened from its "Visit" link.
  const [openVisit, setOpenVisit] = useState<string | null>(null)

  return (
    <Card className="mt-4 gap-0 py-0 animate-in fade-in duration-300">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3 [.border-b]:pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Stethoscope className="text-primary" size={16} />
            Treatments
            {treatments.length > 0 && (
              <Badge variant="secondary" className="text-[11px]">
                {treatments.length}
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            All treatments performed — linked to a visit or standalone.
          </p>
        </div>
        {!hideAmounts && (
          <Can perm="patients.clinical.edit">
            <TreatmentFormDialog patientId={patient.id} />
          </Can>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : treatments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Stethoscope size={28} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">No treatments recorded.</p>
            <p className="text-xs">
              Record a treatment against this patient, optionally linked to a
              visit.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-2">Treatment</th>
                  <th className="px-4 py-2">Plan</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Link</th>
                  {!hideAmounts && (
                    <th className="px-4 py-2 text-right">Cost</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {treatments.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{t.treatmentName}</div>
                      {t.notes && (
                        <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <FileText size={10} /> {t.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.planTemplate ? (
                        <Badge variant="secondary" className="text-[11px]">
                          {t.planTemplate.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {formatYmd(t.date)}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.encounterId ? (
                        <button
                          type="button"
                          onClick={() => setOpenVisit(t.encounterId)}
                          aria-label={`Open the visit of ${t.treatmentName}`}
                          className="inline-flex items-center rounded-md border border-border bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary-text transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Link2 size={10} className="mr-1" /> Visit
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Standalone
                        </span>
                      )}
                    </td>
                    {!hideAmounts && (
                      <td className="px-4 py-2.5 text-right font-medium">
                        {t.cost != null ? (
                          <span className="inline-flex items-center gap-1">
                            <Banknote size={13} /> Rs.{' '}
                            {num(t.cost).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      <VisitDetailSheet
        patientId={patient.id}
        encounterId={openVisit}
        onClose={() => setOpenVisit(null)}
        hideAmounts={hideAmounts}
      />
    </Card>
  )
}
