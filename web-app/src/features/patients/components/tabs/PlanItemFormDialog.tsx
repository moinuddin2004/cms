import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useForm } from '@tanstack/react-form';
import { useCreateTreatmentPlanItem } from '../../hooks/usePatientSubEntities';
import { Loader2, Plus } from 'lucide-react';

export function PlanItemFormDialog({ patientId, planId }: { patientId: string, planId: string }) {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateTreatmentPlanItem();

  const form = useForm({
    defaultValues: {
      procedureName: '',
      procedureCode: '',
      toothNumber: '',
      estimatedSessions: 1,
      estimatedCost: 0,
    },
    onSubmit: async ({ value }) => {
      mutate({
        patientId,
        planId,
        ...value,
      }, {
        onSuccess: () => setOpen(false)
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus size={14} className="mr-1.5" /> Add Procedure
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Procedure</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }} className="space-y-4 pt-4">
          
          <form.Field name="procedureName">
            {(field) => (
              <div className="space-y-2">
                <Label>Procedure Name</Label>
                <Input value={field.state.value} onChange={e => field.handleChange(e.target.value)} required placeholder="e.g., Root Canal" />
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="procedureCode">
              {(field) => (
                <div className="space-y-2">
                  <Label>Code (Optional)</Label>
                  <Input value={field.state.value} onChange={e => field.handleChange(e.target.value)} placeholder="e.g., D3310" />
                </div>
              )}
            </form.Field>

            <form.Field name="toothNumber">
              {(field) => (
                <div className="space-y-2">
                  <Label>Tooth #</Label>
                  <Input value={field.state.value} onChange={e => field.handleChange(e.target.value)} placeholder="e.g., 14" />
                </div>
              )}
            </form.Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="estimatedSessions">
              {(field) => (
                <div className="space-y-2">
                  <Label>Est. Sessions</Label>
                  <Input type="number" min={1} value={field.state.value} onChange={e => field.handleChange(Number(e.target.value))} />
                </div>
              )}
            </form.Field>

            <form.Field name="estimatedCost">
              {(field) => (
                <div className="space-y-2">
                  <Label>Cost (Rs.)</Label>
                  <Input type="number" value={field.state.value} onChange={e => field.handleChange(Number(e.target.value))} />
                </div>
              )}
            </form.Field>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="mr-2">Cancel</Button>
            <Button type="submit" disabled={isPending || !form.state.values.procedureName}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
