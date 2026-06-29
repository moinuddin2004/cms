import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  Heart,
  ShieldAlert,
  FileText,
  User,
  Activity,
  Pencil,
} from 'lucide-react'
import type { Patient } from '../../types'
import { useVitals } from '../../hooks/usePatientSubEntities'
import { EditPatientSheet } from '../EditPatientSheet'

export function OverviewTab({ patient }: { patient: Patient }) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <div className="space-y-4 mt-4 animate-in fade-in duration-300">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
          <Pencil size={14} /> Edit Details
        </Button>
      </div>
      <EditPatientSheet patient={patient} open={editOpen} onOpenChange={setEditOpen} />
      <LatestVitalsCard patientId={patient.id} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Medical Info */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Heart size={16} className="text-brand-600" />
            Medical Quick Access
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              General Medical History
            </p>
            <p className="text-sm">
              {patient.medicalHistory || (
                <span className="text-muted-foreground italic">
                  No medical history recorded
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Known Allergies
            </p>
            {patient.allergies ? (
              <div className="flex flex-wrap gap-1.5">
                {patient.allergies.split(',').map((allergy) => (
                  <Badge
                    key={allergy.trim()}
                    variant="secondary"
                    className="bg-destructive/10 text-destructive border-destructive/20"
                  >
                    <AlertTriangle size={10} className="mr-1" />
                    {allergy.trim()}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No known allergies
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tags and Alerts */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Alerts & Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Patient Tags
            </p>
            {patient.tags && patient.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {patient.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="bg-brand-50 text-brand-700"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No tags added
              </p>
            )}
          </div>

          {(patient.isMinor || patient.isBlacklisted) && (
            <div className="space-y-2 mt-2">
              {patient.isMinor && (
                <div className="flex items-start gap-2 bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-100">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">Minor Patient</p>
                    <p className="text-xs">
                      Guardian required for consent: {patient.guardianName} (
                      {patient.guardianRelation}) - {patient.guardianPhone}
                    </p>
                  </div>
                </div>
              )}
              {patient.isBlacklisted && (
                <div className="flex items-start gap-2 bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">Blacklisted Patient</p>
                    <p className="text-xs">
                      Reason: {patient.blacklistReason || 'Not specified'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert size={16} className="text-status-warning" />
            Emergency Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          {patient.emergencyContactName ? (
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Name" value={patient.emergencyContactName} />
              <InfoRow label="Phone" value={patient.emergencyContactPhone} />
              <InfoRow
                label="Relation"
                value={patient.emergencyContactRelation}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No emergency contact on file
            </p>
          )}
        </CardContent>
      </Card>

      {/* Demographics & Notes */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User size={16} className="text-muted-foreground" />
            Demographics & Internal
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="CNIC" value={patient.cnic} />
            <InfoRow label="Marital Status" value={patient.maritalStatus} />
            <InfoRow label="Occupation" value={patient.occupation} />
            <InfoRow label="Source" value={patient.source?.replace('_', ' ')} />
          </div>
          {patient.internalNotes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                <FileText size={12} /> Internal Notes
              </p>
              <p className="text-sm text-muted-foreground italic bg-muted/50 p-3 rounded-lg border">
                {patient.internalNotes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

function LatestVitalsCard({ patientId }: { patientId: string }) {
  const { data: vitals = [] } = useVitals(patientId)
  const latest = vitals[0]
  if (!latest) return null

  const metrics = [
    {
      label: 'BP',
      value:
        latest.bpSystolic || latest.bpDiastolic
          ? `${latest.bpSystolic ?? '-'}/${latest.bpDiastolic ?? '-'}`
          : null,
    },
    { label: 'Pulse', value: latest.pulseRate, unit: 'bpm' },
    { label: 'Temp', value: latest.temperature, unit: '°C' },
    { label: 'SpO₂', value: latest.oxygenSaturation, unit: '%' },
    { label: 'Weight', value: latest.weightKg, unit: 'kg' },
    { label: 'BMI', value: latest.bmi },
  ].filter((m) => m.value !== null && m.value !== undefined && m.value !== '')

  return (
    <Card>
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity size={16} className="text-brand-600" />
            Latest Vitals
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {new Date(latest.recordedAt).toLocaleString()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {metrics.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
            {metrics.map((m) => (
              <div key={m.label}>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="font-semibold text-base">
                  {m.value}
                  {m.unit ? (
                    <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                      {m.unit}
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No measurements in the latest record.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5 font-medium">
        {value || <span className="text-muted-foreground font-normal">—</span>}
      </p>
    </div>
  )
}
