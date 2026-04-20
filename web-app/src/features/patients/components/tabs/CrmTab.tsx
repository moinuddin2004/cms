import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle, PhoneCall, Mail, UserPlus, Star } from 'lucide-react';
import type { Patient } from '../../types';

export function CrmTab({ patient }: { patient: Patient }) {
  // Mocking CRM data since we don't have hooks for it directly yet
  const isLoading = false;
  const communications: any[] = [];
  const referrals: any[] = [];
  const feedbacks: any[] = [];

  return (
    <div className="space-y-6 mt-4 animate-in fade-in duration-300">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Communication History */}
         <Card className="col-span-1 shadow-sm md:col-span-2">
            <CardHeader className="pb-2 border-b flex flex-row items-center justify-between">
               <div>
                  <CardTitle className="text-md flex items-center gap-2">
                  <MessageCircle className="text-brand-600" size={16} />
                  Communication Logs
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                     WhatsApp, SMS, Email, and Phone calls
                  </CardDescription>
               </div>
               <Button size="sm" variant="outline"><PhoneCall size={14} className="mr-2" /> Log Call</Button>
            </CardHeader>
            <CardContent className="pt-4">
               {communications.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center p-4">No communication history logged.</p>
               ) : (
                  <div>{/* Render list */}</div>
               )}
            </CardContent>
         </Card>

         {/* Referrals */}
         <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b">
               <CardTitle className="text-md flex items-center gap-2">
                  <UserPlus className="text-blue-600" size={16} />
                  Referral Network
               </CardTitle>
               <CardDescription className="text-xs mt-1">
                  Referred by: {patient.referredBy || 'None'}
               </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
               {referrals.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center p-4">Patient hasn't referred anyone yet.</p>
               ) : (
                  <div>{/* Render list */}</div>
               )}
            </CardContent>
         </Card>

         {/* NPS / Feedback */}
         <Card className="shadow-sm">
            <CardHeader className="pb-2 border-b">
               <CardTitle className="text-md flex items-center gap-2">
                  <Star className="text-amber-500" size={16} />
                  Patient Experience
               </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
               {feedbacks.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center p-4">No feedback collected yet.</p>
               ) : (
                  <div>{/* Render list */}</div>
               )}
            </CardContent>
         </Card>

      </div>
    </div>
  );
}
