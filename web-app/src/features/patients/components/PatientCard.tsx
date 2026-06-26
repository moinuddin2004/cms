import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InitialsAvatar, StatusBadge } from '@/components/shared'
import { Eye, Pencil, UserX, Phone, Mail, MapPin } from 'lucide-react'
import type { Patient } from '../types'

interface PatientCardProps {
  patient: Patient
  onDeactivate: (id: string) => void
}

function getAge(dob: string | null): string {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  return `${age}y`
}

export function PatientCard({ patient, onDeactivate }: PatientCardProps) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:-translate-y-px hover:border-primary hover:shadow-md">
      <CardContent className="p-[18px]">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={patient.fullName} seed={patient.id} size="md" />
            <div>
              <Link
                to="/patients/$patientId"
                params={{ patientId: patient.id }}
                className="text-sm font-bold text-foreground transition-colors hover:text-primary-text"
              >
                {patient.fullName}
              </Link>
              <p className="mt-0.5 font-mono text-[11px] text-text-3">
                {patient.patientNumber}
                {patient.dob && ` · ${getAge(patient.dob)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={patient.isActive ? 'active' : 'inactive'} />

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                <Link to="/patients/$patientId" params={{ patientId: patient.id }}>
                  <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                <Link to="/patients/$patientId/edit" params={{ patientId: patient.id }}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </Link>
              </Button>
              {patient.isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    if (confirm('Deactivate this patient?')) onDeactivate(patient.id)
                  }}
                >
                  <UserX className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2 text-xs text-text-2">
          <div className="flex items-center gap-2">
            <Phone size={12} />
            <span>{patient.phone}</span>
          </div>
          {patient.email && (
            <div className="flex items-center gap-2">
              <Mail size={12} />
              <span className="truncate">{patient.email}</span>
            </div>
          )}
          {patient.city && (
            <div className="flex items-center gap-2">
              <MapPin size={12} />
              <span>{patient.city}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {patient.bloodGroup && (
          <div className="mt-3 border-t border-border-soft pt-3">
            <Badge variant="muted">{patient.bloodGroup}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
