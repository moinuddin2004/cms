import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderOpen, FileUp, Shield, Trash2, ShieldAlert } from 'lucide-react';
import type { Patient } from '../../types';

export function AdminTab({ patient }: { patient: Patient }) {
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 animate-in fade-in duration-300">
      
      {/* Document Management */}
      <Card className="col-span-1 md:col-span-2 shadow-sm">
         <CardHeader className="pb-2 border-b flex flex-row items-center justify-between bg-muted/20">
            <CardTitle className="text-md flex items-center gap-2">
               <FolderOpen className="text-brand-600" size={16} />
               Patient Documents & Scans
            </CardTitle>
            <Button size="sm"><FileUp size={14} className="mr-2" /> Upload File</Button>
         </CardHeader>
         <CardContent className="pt-6">
            <div className="min-h-[150px] border-dashed border-2 rounded-lg flex flex-col items-center justify-center text-muted-foreground">
               <FolderOpen size={32} className="opacity-20 mb-2" />
               <p className="text-sm">Drag and drop X-Rays, Scans, and external lab reports here</p>
            </div>
         </CardContent>
      </Card>

      {/* Insurance Details */}
      <Card className="shadow-sm">
         <CardHeader className="pb-2 border-b">
            <CardTitle className="text-md flex items-center gap-2">
               <Shield className="text-blue-600" size={16} />
               Insurance Claim info
            </CardTitle>
         </CardHeader>
         <CardContent className="pt-4 space-y-3">
            <InfoRow label="Insurance Provider" value={patient.insuranceProvider} />
            <InfoRow label="Policy Number" value={patient.insurancePolicyNo} />
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">
        {value || <span className="text-muted-foreground font-normal italic">Not provided</span>}
      </p>
    </div>
  );
}
