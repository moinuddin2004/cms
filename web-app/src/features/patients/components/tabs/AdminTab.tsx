import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderOpen, FileUp, Shield, Trash2, ShieldAlert, Loader2, FileText } from 'lucide-react';
import { useInsurance, useDocuments } from '../../hooks/usePatientSubEntities';
import type { Patient, PatientDocument, PatientInsurance } from '../../types';
import { DocumentFormDialog } from './DocumentFormDialog';

export function AdminTab({ patient }: { patient: Patient }) {
  const { data: insuranceList = [], isLoading: loadingInsurance } = useInsurance(patient.id);
  const { data: documents = [], isLoading: loadingDocs } = useDocuments(patient.id);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 animate-in fade-in duration-300">
      
      {/* Document Management */}
      <Card className="col-span-1 md:col-span-2 shadow-sm">
         <CardHeader className="pb-2 border-b flex flex-row items-center justify-between bg-muted/20">
            <CardTitle className="text-md flex items-center gap-2">
               <FolderOpen className="text-brand-600" size={16} />
               Patient Documents & Scans
            </CardTitle>
            <DocumentFormDialog patientId={patient.id} />
         </CardHeader>
         <CardContent className="pt-6">
            {loadingDocs ? (
               <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : documents.length === 0 ? (
               <div className="min-h-[150px] border-dashed border-2 rounded-lg flex flex-col items-center justify-center text-muted-foreground">
                  <FolderOpen size={32} className="opacity-20 mb-2" />
                  <p className="text-sm">No documents uploaded yet</p>
                  <p className="text-xs mt-1">Upload X-Rays, Scans, and external lab reports</p>
               </div>
            ) : (
               <div className="space-y-2">
                  {documents.map((doc) => (
                     <DocumentRow key={doc.id} document={doc} />
                  ))}
               </div>
            )}
         </CardContent>
      </Card>

      {/* Insurance Details */}
      <Card className="shadow-sm">
         <CardHeader className="pb-2 border-b">
            <CardTitle className="text-md flex items-center gap-2">
               <Shield className="text-blue-600" size={16} />
               Insurance Information
            </CardTitle>
         </CardHeader>
         <CardContent className="pt-4 space-y-3">
            {loadingInsurance ? (
               <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : insuranceList.length === 0 ? (
               <p className="text-sm text-muted-foreground italic text-center py-4">
                  No insurance records on file.
               </p>
            ) : (
               insuranceList.map((ins) => (
                  <InsuranceCard key={ins.id} insurance={ins} />
               ))
            )}
         </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/20 shadow-sm bg-destructive/5">
         <CardHeader className="pb-2 border-b border-destructive/10">
            <CardTitle className="text-md flex items-center gap-2 text-destructive">
               <ShieldAlert size={16} />
               Danger Zone
            </CardTitle>
         </CardHeader>
         <CardContent className="pt-4 space-y-4">
            <div className="flex items-center justify-between border-b border-destructive/10 pb-4">
               <div>
                  <p className="text-sm font-semibold text-destructive">Blacklist Patient</p>
                  <p className="text-xs text-muted-foreground">Prevent future bookings across branches.</p>
               </div>
               <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10">
                  {patient.isBlacklisted ? 'Un-blacklist' : 'Blacklist'}
               </Button>
            </div>

            <div className="flex items-center justify-between">
               <div>
                  <p className="text-sm font-semibold text-destructive">Soft Delete Record</p>
                  <p className="text-xs text-muted-foreground">Mark this patient as deleted. Data remains for legal retention.</p>
               </div>
               <Button variant="destructive" size="sm">
                  <Trash2 size={14} className="mr-2" /> Delete
               </Button>
            </div>
         </CardContent>
      </Card>
      
    </div>
  );
}

function DocumentRow({ document }: { document: PatientDocument }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-muted rounded-md">
          <FileText size={16} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{document.fileName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              {document.documentType.replace('_', ' ')}
            </Badge>
            {document.toothNumber && (
              <span className="text-[10px] text-muted-foreground">Tooth #{document.toothNumber}</span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {new Date(document.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
      {document.fileSizeBytes && (
        <span className="text-xs text-muted-foreground">
          {(document.fileSizeBytes / 1024).toFixed(0)} KB
        </span>
      )}
    </div>
  );
}

function InsuranceCard({ insurance }: { insurance: PatientInsurance }) {
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{insurance.providerName}</p>
        <Badge
          variant={insurance.isActive ? 'default' : 'secondary'}
          className={insurance.isActive
            ? 'bg-green-100 text-green-700 hover:bg-green-100'
            : 'bg-muted text-muted-foreground'
          }
        >
          {insurance.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <InfoRow label="Policy Number" value={insurance.policyNumber} />
        <InfoRow label="Plan" value={insurance.planName} />
        <InfoRow label="Coverage" value={insurance.coveragePercentage ? `${insurance.coveragePercentage}%` : null} />
        <InfoRow label="Valid Until" value={insurance.validUntil ? new Date(insurance.validUntil).toLocaleDateString() : null} />
      </div>
    </div>
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
      <p className="text-sm font-medium mt-0.5">
        {value || <span className="text-muted-foreground font-normal italic">—</span>}
      </p>
    </div>
  );
}
