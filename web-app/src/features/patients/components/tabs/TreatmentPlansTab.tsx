import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Stethoscope, Banknote, Calendar } from 'lucide-react';
import { useTreatmentPlans } from '../../hooks/usePatientSubEntities';
import type { Patient, PatientTreatmentPlan, TreatmentPlanItem } from '../../types';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function TreatmentPlansTab({ patient }: { patient: Patient }) {
  const { data: plans = [], isLoading } = useTreatmentPlans(patient.id);

  return (
    <div className="space-y-4 mt-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
         <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
            <Stethoscope className="text-brand-600" size={20} />
            Treatment Plans
            </h3>
            <p className="text-sm text-muted-foreground">Comprehensive multi-session plans and estimates.</p>
         </div>
         <Button size="sm">
            <Plus className="mr-2" size={16} /> New Plan
         </Button>
      </div>

      {isLoading ? (
         <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : plans.length === 0 ? (
         <Card className="min-h-[200px] flex flex-col items-center justify-center p-6 border-dashed bg-muted/20 text-muted-foreground text-center">
            <Stethoscope size={32} className="mx-auto mb-4 opacity-20" />
            <p className="font-medium">No treatment plans found.</p>
            <p className="text-xs">Create a new treatment plan to sequence procedures and provide cost estimates.</p>
         </Card>
      ) : (
         <Accordion type="single" collapsible className="w-full space-y-3">
            {plans.map((plan) => (
               <PlanAccordionItem key={plan.id} plan={plan} />
            ))}
         </Accordion>
      )}
    </div>
  );
}

function PlanAccordionItem({ plan }: { plan: PatientTreatmentPlan }) {
   return (
      <AccordionItem value={plan.id} className="border rounded-lg bg-card px-4 pt-1 shadow-sm data-[state=open]:ring-1 ring-brand-200">
         <AccordionTrigger className="hover:no-underline">
            <div className="flex flex-1 items-center justify-between pr-4">
               <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                     <span className="font-bold text-base">{plan.planNumber}</span>
                     <span className="hidden sm:inline-block text-muted-foreground ml-2 text-sm">{plan.planName}</span>
                     <Badge variant="secondary" className={
                        plan.status === 'active' ? 'bg-green-100 text-green-700' :
                        plan.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        plan.status === 'proposed' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
                     }>
                        {plan.status.toUpperCase()}
                     </Badge>
                  </div>
                  {plan.patientAccepted && (
                     <Badge variant="outline" className="text-[10px] h-5 bg-brand-50 text-brand-700">ACCEPTED</Badge>
                  )}
               </div>
               
               <div className="flex flex-col items-end gap-1 mr-4">
                  <div className="flex items-center gap-1 font-semibold text-brand-700">
                     <Banknote size={14} /> Rs. {plan.finalEstimatedCost?.toLocaleString() || plan.estimatedCost?.toLocaleString() || '0'}
                  </div>
                  {plan.expectedEndDate && (
                     <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar size={12} /> Target: {new Date(plan.expectedEndDate).toLocaleDateString()}
                     </div>
                  )}
               </div>
            </div>
         </AccordionTrigger>
         <AccordionContent className="pt-2 pb-4">
            <div className="pl-2 pr-2">
               {plan.description && (
                  <p className="text-sm text-muted-foreground mb-4 border-l-2 border-brand-200 pl-3">
                     {plan.description}
                  </p>
               )}

               <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm text-left relative">
                     <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b">
                        <tr>
                           <th className="px-4 py-2">Seq</th>
                           <th className="px-4 py-2">Procedure</th>
                           <th className="px-4 py-2">Tooth</th>
                           <th className="px-4 py-2">Sessions</th>
                           <th className="px-4 py-2">Cost</th>
                           <th className="px-4 py-2">Status</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y">
                        {plan.items && plan.items.length > 0 ? (
                           plan.items.map((item) => (
                              <PlanItemRow key={item.id} item={item} />
                           ))
                        ) : (
                           <tr>
                              <td colSpan={6} className="px-4 py-4 text-center text-muted-foreground italic">
                                 No procedures added to this plan yet.
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
               <div className="mt-4 flex justify-end">
                  <Button variant="outline" size="sm">
                     <Plus size={14} className="mr-1.5" /> Add Procedure
                  </Button>
               </div>
            </div>
         </AccordionContent>
      </AccordionItem>
   )
}

function PlanItemRow({ item }: { item: TreatmentPlanItem }) {
   return (
      <tr className="hover:bg-muted/30 transition-colors">
         <td className="px-4 py-2.5 font-medium">{item.sequenceOrder}</td>
         <td className="px-4 py-2.5">
            <div className="font-medium">{item.procedureName}</div>
            {item.procedureCode && <div className="text-[10px] text-muted-foreground uppercase">{item.procedureCode}</div>}
         </td>
         <td className="px-4 py-2.5">
            {item.toothNumber ? (
               <Badge variant="outline">{item.toothNumber}</Badge>
            ) : <span className="text-muted-foreground">-</span>}
         </td>
         <td className="px-4 py-2.5 text-xs text-muted-foreground">
            {item.completedSessions} / {item.estimatedSessions}
         </td>
         <td className="px-4 py-2.5 font-medium">Rs. {item.estimatedCost?.toLocaleString() || '0'}</td>
         <td className="px-4 py-2.5">
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
               {item.status.replace('_', ' ')}
            </Badge>
         </td>
      </tr>
   )
}
