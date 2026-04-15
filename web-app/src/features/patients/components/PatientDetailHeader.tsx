import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Pencil, Phone, Mail } from 'lucide-react';
import type { Patient } from '../types';

interface PatientDetailHeaderProps {
  patient: Patient;
}

function getAge(dob: string | null): string {
  if (!dob) return '—';
  const diff = Date.now() - new Date(dob).getTime();
  return `${Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))} years`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function PatientDetailHeader({ patient }: PatientDetailHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Back Link */}
      <Link
        to="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Patients
      </Link>

      {/* Patient Info */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14">
            <AvatarFallback className="bg-brand-100 text-brand-700 font-bold text-lg">
              {getInitials(patient.fullName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {patient.fullName}
              </h1>
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
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{patient.patientId}</span>
              {patient.dob && <span>{getAge(patient.dob)}</span>}
              {patient.gender && (
                <span className="capitalize">{patient.gender}</span>
              )}
              {patient.bloodGroup && (
                <Badge variant="outline" className="text-xs">
                  {patient.bloodGroup}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone size={12} /> {patient.phone}
              </span>
              {patient.email && (
                <span className="flex items-center gap-1">
                  <Mail size={12} /> {patient.email}
                </span>
              )}
            </div>
          </div>
        </div>

        <Button asChild variant="outline" id="edit-patient-btn">
          <Link to="/patients/$patientId/edit" params={{ patientId: patient.id }}>
            <Pencil size={14} className="mr-1.5" />
            Edit Patient
          </Link>
        </Button>
      </div>
    </div>
  );
}
