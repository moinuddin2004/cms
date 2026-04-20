import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from '@tanstack/react-form';
import { Loader2, Plus, Activity, Droplets } from 'lucide-react';
import { useVitals, useDentalInfo, useUpsertDentalInfo, useCreateVitals } from '../../hooks/usePatientSubEntities';
import type { Patient, PatientVitals } from '../../types';
import { Label } from '@/components/ui/label';

export function VitalsAndDentalTab({ patient }: { patient: Patient }) {
  const { data: vitals = [], isLoading: loadingVitals } = useVitals(patient.id);
  const { data: dentalInfo, isLoading: loadingDental } = useDentalInfo(patient.id);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-4 animate-in fade-in duration-300">
      
      {/* Vitals Section */}
      <div className="space-y-4">
         <div className="flex items-center justify-between">
           <h3 className="text-lg font-semibold flex items-center gap-2">
             <Activity className="text-brand-600" size={20} />
             Patient Vitals History
           </h3>
         </div>

         {loadingVitals ? (
           <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
         ) : vitals.length === 0 ? (
           <Card className="border-dashed bg-muted/20">
             <CardContent className="text-center py-10 text-muted-foreground">
                <Activity size={32} className="mx-auto mb-2 opacity-30" />
                <p>No vitals recorded yet.</p>
             </CardContent>
           </Card>
         ) : (
           <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
             {vitals.map((vital) => (
                <VitalCard key={vital.id} vital={vital} />
             ))}
           </div>
         )}

         {/* Vitals Quick Form */}
         <Card className="mt-6 border-brand-100 bg-brand-50/20">
            <CardHeader className="pb-3">
               <CardTitle className="text-md flex items-center gap-2">
                  <Plus size={16} /> Record New Vitals
               </CardTitle>
            </CardHeader>
            <CardContent>
               <VitalsForm patientId={patient.id} />
            </CardContent>
         </Card>
      </div>

      {/* Dental Info Section */}
      <div className="space-y-4">
         <div className="flex items-center justify-between">
           <h3 className="text-lg font-semibold flex items-center gap-2">
             <Droplets className="text-blue-500" size={20} />
             Dental Health & Habits
           </h3>
         </div>
         
         <Card>
           <CardContent className="pt-6">
              {loadingDental ? (
                 <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
              ) : (
                 <p className="text-sm text-muted-foreground">Detailed Dental Info form will be rendered here to upsert dental state (brushing frequency, gum condition, etc.)</p>
              )}
           </CardContent>
         </Card>
      </div>

    </div>
  );
}

function VitalCard({ vital }: { vital: PatientVitals }) {
  return (
     <Card className="shadow-sm">
        <CardContent className="p-4">
           <div className="flex justify-between items-start mb-2 border-b pb-2">
              <span className="text-xs font-semibold text-muted-foreground">
                 {new Date(vital.recordedAt).toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">By: {vital.recordedBy}</span>
           </div>
           <div className="grid grid-cols-4 gap-2 text-center text-sm mt-3">
              <div>
                 <p className="text-xs text-muted-foreground">BP</p>
                 <p className="font-semibold">{vital.bpSystolic || '-'}/{vital.bpDiastolic || '-'}</p>
              </div>
              <div>
                 <p className="text-xs text-muted-foreground">Pulse</p>
                 <p className="font-semibold">{vital.pulseRate || '-'}</p>
              </div>
              <div>
                 <p className="text-xs text-muted-foreground">Temp</p>
                 <p className="font-semibold">{vital.temperature || '-'} °C</p>
              </div>
              <div>
                 <p className="text-xs text-muted-foreground">BMI</p>
                 <p className="font-semibold">{vital.bmi || '-'}</p>
              </div>
           </div>
        </CardContent>
     </Card>
  )
}

function VitalsForm({ patientId }: { patientId: string }) {
   const { mutate, isPending } = useCreateVitals();

   const form = useForm({
      defaultValues: {
         bpSystolic: undefined as number | undefined,
         bpDiastolic: undefined as number | undefined,
         pulseRate: undefined as number | undefined,
         temperature: undefined as number | undefined,
         weightKg: undefined as number | undefined,
         heightCm: undefined as number | undefined,
      },
      onSubmit: async ({ value }) => {
         mutate({
            patientId,
            ...value,
            recordedBy: 'system' // Should be current user later
         });
      }
   });

   return (
      <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}>
         <div className="grid grid-cols-3 gap-3">
            <form.Field name="bpSystolic">
               {(field) => (
                  <div className="space-y-1">
                     <Label className="text-xs">Systolic</Label>
                     <Input type="number" value={field.state.value || ''} onChange={e => field.handleChange(Number(e.target.value) || undefined)} placeholder="120" />
                  </div>
               )}
            </form.Field>
            <form.Field name="bpDiastolic">
               {(field) => (
                  <div className="space-y-1">
                     <Label className="text-xs">Diastolic</Label>
                     <Input type="number" value={field.state.value || ''} onChange={e => field.handleChange(Number(e.target.value) || undefined)} placeholder="80" />
                  </div>
               )}
            </form.Field>
            <form.Field name="pulseRate">
               {(field) => (
                  <div className="space-y-1">
                     <Label className="text-xs">Pulse (bpm)</Label>
                     <Input type="number" value={field.state.value || ''} onChange={e => field.handleChange(Number(e.target.value) || undefined)} placeholder="72" />
                  </div>
               )}
            </form.Field>
            <form.Field name="weightKg">
               {(field) => (
                  <div className="space-y-1">
                     <Label className="text-xs">Weight (kg)</Label>
                     <Input type="number" value={field.state.value || ''} onChange={e => field.handleChange(Number(e.target.value) || undefined)} placeholder="70" />
                  </div>
               )}
            </form.Field>
            <form.Field name="heightCm">
               {(field) => (
                  <div className="space-y-1">
                     <Label className="text-xs">Height (cm)</Label>
                     <Input type="number" value={field.state.value || ''} onChange={e => field.handleChange(Number(e.target.value) || undefined)} placeholder="175" />
                  </div>
               )}
            </form.Field>
            <div className="flex items-end">
               <Button type="submit" className="w-full" size="sm" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Vitals
               </Button>
            </div>
         </div>
      </form>
   )
}
