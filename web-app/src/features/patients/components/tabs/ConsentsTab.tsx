import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, FileSignature, AlertTriangle, Printer } from 'lucide-react';
import { useConsents } from '../../hooks/usePatientSubEntities';
import type { Patient, PatientConsent } from '../../types';

export function ConsentsTab({ patient }: { patient: Patient }) {
  const { data: consents = [], isLoading } = useConsents(patient.id);

  return (
    <div className="space-y-4 mt-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
         <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileSignature className="text-brand-600" size={20} />
            Legal Consents
            </h3>
            <p className="text-sm text-muted-foreground bg-amber-50 text-amber-800 p-2 rounded-md mt-2 inline-flex items-center gap-2 border border-amber-200">
               <AlertTriangle size={14} /> Consents are immutable. Once signed and captured, they cannot be deleted or modified.
            </p>
         </div>
         <Button size="sm">
            Capture Signature
         </Button>
      </div>

      {isLoading ? (
         <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : consents.length === 0 ? (
         <Card className="min-h-[200px] flex flex-col items-center justify-center p-6 border-dashed bg-muted/20 text-muted-foreground text-center">
            <FileSignature size={32} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">No consents recorded.</p>
         </Card>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {consents.map(consent => (
               <ConsentCard key={consent.id} consent={consent} isMinor={patient.isMinor} />
            ))}
         </div>
      )}
    </div>
  );
}

function ConsentCard({ consent, isMinor }: { consent: PatientConsent, isMinor?: boolean }) {
   return (
      <Card className={`relative overflow-hidden shadow-sm ${consent.status !== 'signed' ? 'bg-muted/50 border-dashed' : 'border-brand-200'}`}>
         {consent.status === 'revoked' && (
            <div className="absolute top-4 right-4 rotate-12 opacity-80 z-10 pointer-events-none">
               <Badge variant="destructive" className="px-3 py-1 text-xs uppercase tracking-wider font-bold">REVOKED</Badge>
            </div>
         )}
         <CardHeader className="pb-2 border-b bg-muted/20">
            <div className="flex justify-between items-start">
               <div>
                  <CardTitle className="text-md flex items-center gap-2">
                     {consent.consentType.replace('_', ' ')}
                  </CardTitle>
                  <CardDescription className="text-[10px] mt-1 font-mono uppercase">
                     {consent.consentId}
                  </CardDescription>
               </div>
               {consent.status === 'signed' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted" title="Print/Download PDF">
                     <Printer size={14} />
                  </Button>
               )}
            </div>
         </CardHeader>
         <CardContent className="pt-3 text-sm">
            <div className="grid grid-cols-2 gap-y-2 mb-3">
               <div>
                  <p className="text-xs text-muted-foreground">Signed Date</p>
                  <p className="font-medium">{consent.signedAt ? new Date(consent.signedAt).toLocaleDateString() : 'N/A'}</p>
               </div>
               <div>
                  <p className="text-xs text-muted-foreground">Signatory Type</p>
                  <p className="font-medium text-xs uppercase bg-muted px-2 py-0.5 rounded-sm inline-block">
                     {isMinor ? 'GUARDIAN' : 'PATIENT'}
                  </p>
               </div>
               {consent.signedByGuardianName && (
                  <div className="col-span-2 mt-1 bg-amber-50 p-2 rounded border border-amber-100">
                     <p className="text-xs text-muted-foreground">Guardian Info</p>
                     <p className="font-medium">{consent.signedByGuardianName} ({consent.guardianRelation})</p>
                  </div>
               )}
            </div>
            
            <div className="mt-4 p-3 border rounded-lg bg-background">
               <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Signature Base64</p>
               {consent.signatureData ? (
                  <div className="h-12 border bg-muted/10 w-full rounded flex items-center justify-center italic text-xs text-muted-foreground overflow-hidden px-2 whitespace-nowrap text-ellipsis">
                     {consent.signatureData.substring(0, 40)}...
                  </div>
               ) : (
                  <p className="text-xs italic text-muted-foreground">No signature data captured.</p>
               )}
            </div>
         </CardContent>
      </Card>
   )
}
