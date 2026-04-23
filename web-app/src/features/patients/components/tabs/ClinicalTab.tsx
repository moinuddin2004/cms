import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, ClipboardList, Printer, Calendar } from 'lucide-react'
import { usePrescriptions } from '../../hooks/usePatientSubEntities'
import type { Patient, PatientPrescription } from '../../types'
import { PrescriptionFormDialog } from './PrescriptionFormDialog'

export function ClinicalTab({ patient }: { patient: Patient }) {
  const { data: prescriptions = [], isLoading } = usePrescriptions(patient.id)

  return (
    <div className="space-y-6 mt-4 animate-in fade-in duration-300">
      {/* Rx Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ClipboardList className="text-brand-600" size={20} />
              Prescriptions
            </h3>
            <p className="text-sm text-muted-foreground">
              History of prescribed medications.
            </p>
          </div>
          <PrescriptionFormDialog patientId={patient.id} />
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : prescriptions.length === 0 ? (
          <Card className="min-h-[150px] flex flex-col items-center justify-center p-6 border-dashed bg-muted/20 text-muted-foreground text-center">
            <p className="font-medium">No prescriptions found.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {prescriptions.map((px) => (
              <PrescriptionCard key={px.id} rx={px} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PrescriptionCard({ rx }: { rx: PatientPrescription }) {
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Print Rx"
            >
              <Printer size={14} />
            </Button>
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
