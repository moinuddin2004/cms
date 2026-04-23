import { Link } from '@tanstack/react-router'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Eye,
  Pencil,
  UserX,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react'
import type { Patient } from '../types'

interface PatientCardProps {
  patient: Patient
  onDeactivate: (id: string) => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getAge(dob: string | null): string {
  if (!dob) return '—'
  const diff = Date.now() - new Date(dob).getTime()
  const age = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  return `${age}y`
}

export function PatientCard({ patient, onDeactivate }: PatientCardProps) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-brand-200">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-11 h-11">
              <AvatarFallback className="bg-brand-100 text-brand-700 font-semibold text-sm">
                {getInitials(patient.fullName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <Link
                to="/patients/$patientId"
                params={{ patientId: patient.id }}
                className="font-semibold text-sm text-foreground hover:text-brand-600 transition-colors"
              >
                {patient.fullName}
              </Link>
              <p className="text-xs text-muted-foreground mt-0.5">
                {patient.patientNumber}
                {patient.dob && ` · ${getAge(patient.dob)}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={patient.isActive ? 'default' : 'secondary'}
              className={
                patient.isActive
                  ? 'bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/10'
                  : 'bg-muted text-muted-foreground'
              }
            >
              {patient.isActive ? 'Active' : 'Inactive'}
            </Badge>

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
        <div className="space-y-2 text-xs text-muted-foreground">
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
          <div className="mt-3 pt-3 border-t border-border">
            <Badge variant="outline" className="text-xs">
              {patient.bloodGroup}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
