import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Stethoscope, Banknote, Link2, FileText } from 'lucide-react'
import { usePatientTreatments } from '../../hooks/usePatientSubEntities'
import type { Patient } from '../../types'
import { TreatmentFormDialog } from './TreatmentFormDialog'

const num = (v: number | string | null | undefined) =>
  v == null ? 0 : typeof v === 'string' ? parseFloat(v) || 0 : v

export function TreatmentsTab({ patient }: { patient: Patient }) {
  const { data: treatments = [], isLoading } = usePatientTreatments(patient.id)

  return (
    <div className="space-y-4 mt-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Stethoscope className="text-brand-600" size={20} />
            Treatments
          </h3>
          <p className="text-sm text-muted-foreground">
            All treatments performed — linked to a visit or standalone.
          </p>
        </div>
        <TreatmentFormDialog patientId={patient.id} />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : treatments.length === 0 ? (
        <Card className="min-h-[200px] flex flex-col items-center justify-center p-6 border-dashed bg-muted/20 text-muted-foreground text-center">
          <Stethoscope size={32} className="mx-auto mb-4 opacity-20" />
          <p className="font-medium">No treatments recorded.</p>
          <p className="text-xs">
            Record a treatment against this patient, optionally linked to a
            visit.
          </p>
        </Card>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-2">Treatment</th>
                <th className="px-4 py-2">Plan</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Link</th>
                <th className="px-4 py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {treatments.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
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
                    {new Date(t.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.encounterId ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-brand-50 text-brand-700"
                      >
                        <Link2 size={10} className="mr-1" /> Visit
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Standalone
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    {t.cost != null ? (
                      <span className="inline-flex items-center gap-1">
                        <Banknote size={13} /> Rs. {num(t.cost).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
