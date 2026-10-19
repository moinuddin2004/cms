import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  CalendarDays,
  Stethoscope,
  Banknote,
  Plus,
} from 'lucide-react'
import { useEncounterDetail } from '../../hooks/usePatientSubEntities'
import { TreatmentFormDialog } from './TreatmentFormDialog'

const num = (v: number | string | null | undefined) =>
  v == null ? 0 : typeof v === 'string' ? parseFloat(v) || 0 : v

interface EncounterDetailDialogProps {
  patientId: string
  encounterId: string | null
  onClose: () => void
  /** Clinical-only view (doctor's consultation): no fees, no fee entry. */
  hideAmounts?: boolean
}

export function EncounterDetailDialog({
  patientId,
  encounterId,
  onClose,
  hideAmounts = false,
}: EncounterDetailDialogProps) {
  const { data: encounter, isLoading } = useEncounterDetail(encounterId)

  return (
    <Dialog open={!!encounterId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Visit Details</DialogTitle>
          <DialogDescription className="sr-only">
            Visit record with its source appointment and treatments.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !encounter ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* When */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold inline-flex items-center gap-1.5 mb-1.5">
                <CalendarDays size={14} /> Visit date
              </p>
              <p className="text-sm font-medium">
                {new Date(encounter.encounterDate).toLocaleString()}
              </p>
              {encounter.reason && (
                <p className="text-xs italic text-muted-foreground mt-1">
                  “{encounter.reason}”
                </p>
              )}
            </div>

            <Separator />

            {/* Source appointment */}
            {encounter.appointment && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold inline-flex items-center gap-1.5 mb-1.5">
                  <Stethoscope size={14} /> Source appointment
                </p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline" className="capitalize">
                    {encounter.appointment.type.replace('_', ' ')}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {encounter.appointment.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(encounter.appointment.startTime).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <Separator />

            {/* Treatments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Treatments ({encounter.treatments?.length ?? 0})
                </p>
                {!hideAmounts && (
                  <TreatmentFormDialog
                    patientId={patientId}
                    encounterId={encounter.id}
                    trigger={
                      <Button size="sm" variant="outline">
                        <Plus size={14} className="mr-1.5" /> Add treatment
                      </Button>
                    }
                  />
                )}
              </div>

              {encounter.treatments && encounter.treatments.length > 0 ? (
                <div className="rounded-md border divide-y">
                  {encounter.treatments.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {t.treatmentName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(t.date).toLocaleDateString()}
                          {t.notes ? ` · ${t.notes}` : ''}
                        </p>
                      </div>
                      {!hideAmounts && t.cost != null && (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 shrink-0">
                          <Banknote size={14} /> Rs.{' '}
                          {num(t.cost).toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No treatments recorded for this visit yet.
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
