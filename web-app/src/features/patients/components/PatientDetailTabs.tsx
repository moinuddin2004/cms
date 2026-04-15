import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays,
  Stethoscope,
  Receipt,
  ClipboardList,
  FlaskConical,
  FolderOpen,
  AlertTriangle,
  Heart,
} from 'lucide-react';
import type { Patient } from '../types';

interface PatientDetailTabsProps {
  patient: Patient;
}

export function PatientDetailTabs({ patient }: PatientDetailTabsProps) {
  return (
    <Tabs defaultValue="overview" className="mt-6">
      <TabsList className="bg-muted/50 p-1">
        <TabsTrigger value="overview" className="text-sm">
          Overview
        </TabsTrigger>
        <TabsTrigger value="appointments" className="text-sm">
          <CalendarDays size={14} className="mr-1.5" />
          Appointments
        </TabsTrigger>
        <TabsTrigger value="treatments" className="text-sm">
          <Stethoscope size={14} className="mr-1.5" />
          Treatments
        </TabsTrigger>
        <TabsTrigger value="invoices" className="text-sm">
          <Receipt size={14} className="mr-1.5" />
          Invoices
        </TabsTrigger>
        <TabsTrigger value="prescriptions" className="text-sm">
          <ClipboardList size={14} className="mr-1.5" />
          Prescriptions
        </TabsTrigger>
        <TabsTrigger value="lab" className="text-sm">
          <FlaskConical size={14} className="mr-1.5" />
          Lab Cases
        </TabsTrigger>
        <TabsTrigger value="files" className="text-sm">
          <FolderOpen size={14} className="mr-1.5" />
          Files
        </TabsTrigger>
      </TabsList>

      {/* Overview Tab — Real Data */}
      <TabsContent value="overview" className="mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Medical Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Heart size={14} className="text-brand-600" />
                Medical Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Medical History
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
                  Allergies
                </p>
                {patient.allergies && patient.allergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {patient.allergies.map((allergy) => (
                      <Badge
                        key={allergy}
                        variant="secondary"
                        className="bg-destructive/10 text-destructive border-destructive/20"
                      >
                        <AlertTriangle size={10} className="mr-1" />
                        {allergy}
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

          {/* Emergency Contact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle size={14} className="text-status-warning" />
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {patient.emergencyName ? (
                <>
                  <InfoRow label="Name" value={patient.emergencyName} />
                  <InfoRow label="Phone" value={patient.emergencyPhone} />
                  <InfoRow label="Relation" value={patient.emergencyRelation} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No emergency contact on file
                </p>
              )}
            </CardContent>
          </Card>

          {/* Additional Details */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Additional Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoRow label="City" value={patient.city} />
                <InfoRow label="Address" value={patient.address} />
                <InfoRow label="Occupation" value={patient.occupation} />
                <InfoRow label="Referred By" value={patient.referredBy} />
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Placeholder Tabs */}
      <TabsContent value="appointments" className="mt-4">
        <PlaceholderTab
          icon={<CalendarDays size={40} />}
          title="Appointments"
          description="Patient appointment history will appear here."
        />
      </TabsContent>

      <TabsContent value="treatments" className="mt-4">
        <PlaceholderTab
          icon={<Stethoscope size={40} />}
          title="Treatments"
          description="Patient treatment records will appear here."
        />
      </TabsContent>

      <TabsContent value="invoices" className="mt-4">
        <PlaceholderTab
          icon={<Receipt size={40} />}
          title="Invoices & Payments"
          description="Billing history and payment records will appear here."
        />
      </TabsContent>

      <TabsContent value="prescriptions" className="mt-4">
        <PlaceholderTab
          icon={<ClipboardList size={40} />}
          title="Prescriptions"
          description="Prescription history will appear here."
        />
      </TabsContent>

      <TabsContent value="lab" className="mt-4">
        <PlaceholderTab
          icon={<FlaskConical size={40} />}
          title="Lab Cases"
          description="Lab test results and cases will appear here."
        />
      </TabsContent>

      <TabsContent value="files" className="mt-4">
        <PlaceholderTab
          icon={<FolderOpen size={40} />}
          title="Files"
          description="Patient documents and images will appear here."
        />
      </TabsContent>
    </Tabs>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5">
        {value || <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

function PlaceholderTab({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-muted-foreground/40 mb-4">{icon}</div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
