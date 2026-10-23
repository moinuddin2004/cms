import { Link } from '@tanstack/react-router'
import { Can } from '@/features/access/components/Can'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  ClipboardList,
  Printer,
  Calendar,
  Plus,
  ExternalLink,
  ChevronDown,
  FileText,
  History,
} from 'lucide-react'
import { usePrescriptions } from '../../hooks/usePatientSubEntities'
import type { Patient, PatientPrescription } from '../../types'
import { PrescriptionFormDialog } from './PrescriptionFormDialog'
import { printPrescription } from '../../utils/print'
import { usePrescriptionsByPatient } from '@/features/prescriptions'

export function ClinicalTab({ patient }: { patient: Patient }) {
  const { data: prescriptions = [], isLoading } = usePrescriptions(patient.id)
  const { data: newRxData } = usePrescriptionsByPatient(patient.id, 1, 20)
  const newRxList = newRxData?.data ?? []
  const newRxTotal = newRxData?.total ?? 0
  const legacyCount = prescriptions.length

  return (
    <div className="space-y-6 mt-4 animate-in fade-in duration-300">
      {/* ── Primary: full prescription builder (Rx module) ───────────── */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ClipboardList className="text-brand-600" size={20} />
                Prescriptions
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Bilingual builder with templates, doctor signature, and
                printable PDF.
              </p>
            </div>
            <Can perm="prescriptions.create">
              <Button asChild>
                <Link
                  to={'/prescriptions/new' as any}
                  search={{ patientId: patient.id } as any}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> New Prescription
                </Link>
              </Button>
            </Can>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {newRxList.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-medium">No prescriptions yet</p>
              <p className="text-xs mt-1">
                Click "New Prescription" to create one with the full builder.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {newRxList.map((rx) => (
                <li
                  key={rx.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold">
                          {rx.prescriptionNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            rx.status === 'FINALIZED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                              : rx.status === 'DRAFT'
                                ? 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'
                                : 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]'
                          }
                        >
                          {rx.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {new Date(rx.createdAt).toLocaleDateString('en-GB')}
                        {rx.doctor?.fullName && ` · Dr. ${rx.doctor.fullName}`}
                        {' · '}
                        {rx.medicines?.length ?? 0} medicine
                        {(rx.medicines?.length ?? 0) === 1 ? '' : 's'}
                        {rx.diagnosis ? ` · ${rx.diagnosis}` : ''}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      to={'/prescriptions/$prescriptionId' as any}
                      params={{ prescriptionId: rx.id } as any}
                    >
                      Open <ExternalLink className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {newRxTotal > newRxList.length && (
            <div className="px-4 py-2 text-center border-t text-xs text-muted-foreground">
              Showing {newRxList.length} of {newRxTotal} —{' '}
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

      {/* ── Legacy quick-Rx (collapsed, secondary) ───────────────────── */}
      {(legacyCount > 0 || !isLoading) && (
        <details className="group bg-muted/20 border rounded-lg [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex items-center justify-between cursor-pointer px-4 py-2.5 hover:bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Legacy quick-Rx history
              </span>
              {legacyCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {legacyCount}
                </Badge>
              )}
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pt-1 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Older prescriptions saved in the simple form. Kept for
                reference.
              </p>
              <Can perm="prescriptions.create">
                <PrescriptionFormDialog patientId={patient.id} />
              </Can>
            </div>
            {isLoading ? (
              <div className="flex justify-center p-4">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : legacyCount === 0 ? (
              <p className="text-xs italic text-muted-foreground py-2">
                No legacy prescriptions.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {prescriptions.map((px) => (
                  <PrescriptionCard key={px.id} rx={px} patient={patient} />
                ))}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  )
}

function PrescriptionCard({
  rx,
  patient,
}: {
  rx: PatientPrescription
  patient: Patient
}) {
  return (
    <Card className="shadow-sm border-l-4 border-l-brand-500 overflow-hidden">
      <CardHeader className="bg-muted/30 py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-md font-bold text-foreground">
              {rx.prescriptionNumber}
            </CardTitle>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar size={12} />{' '}
              {new Date(rx.prescriptionDate).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {rx.isPrinted ? (
              <Badge
                variant="secondary"
                className="text-[10px] h-5 bg-green-50 text-green-700 hover:bg-green-100 border-none outline outline-1 outline-green-200"
              >
                Printed ({rx.printCount})
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] h-5">
                Not Printed
              </Badge>
            )}
            <TooltipButton
              tooltip="Print prescription"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
              onClick={() => printPrescription(rx, patient)}
            >
              <Printer size={14} />
            </TooltipButton>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Meds table */}
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/10 text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">Medicine</th>
              <th className="px-4 py-2 font-semibold">Dosage</th>
              <th className="px-4 py-2 font-semibold">Frequency</th>
              <th className="px-4 py-2 font-semibold">Instructions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rx.medications && rx.medications.length > 0 ? (
              rx.medications.map((med: any, idx) => (
                <tr key={idx} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium">
                    {med.name || 'Unknown'}
                  </td>
                  <td className="px-4 py-2.5">{med.dosage || '-'}</td>
                  <td className="px-4 py-2.5">{med.frequency || '-'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {med.instructions || '-'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-4 text-center text-muted-foreground italic text-xs"
                >
                  No medications listed in this prescription object.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {(rx.chiefComplaint || rx.diagnosis || rx.specialInstructions) && (
          <div className="bg-muted/30 p-4 border-t text-sm space-y-2">
            {rx.chiefComplaint && (
              <div>
                <span className="font-semibold text-xs text-muted-foreground uppercase mr-2">
                  Complaint:
                </span>{' '}
                {rx.chiefComplaint}
              </div>
            )}
            {rx.diagnosis && (
              <div>
                <span className="font-semibold text-xs text-muted-foreground uppercase mr-2">
                  Diagnosis:
                </span>{' '}
                {rx.diagnosis}
              </div>
            )}
            {rx.specialInstructions && (
              <div className="text-amber-800 bg-amber-50 rounded p-2 text-xs border border-amber-100">
                <span className="font-bold">Instructions:</span>{' '}
                {rx.specialInstructions}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
