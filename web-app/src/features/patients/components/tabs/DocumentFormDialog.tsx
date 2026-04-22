import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from '@tanstack/react-form';
import { useCreateDocument } from '../../hooks/usePatientSubEntities';
import { useAuthStore } from '@/store/useAuthStore';
import { Loader2, FileUp } from 'lucide-react';
import { DocumentType } from '../../types';

export function DocumentFormDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateDocument();
  const { user } = useAuthStore();

  const form = useForm({
    defaultValues: {
      documentType: DocumentType.XRAY_IOPA,
      fileName: '',
      fileUrl: '', // In a real app, this would come from a file upload service (e.g., S3)
      notes: '',
      toothNumber: '',
      isVisibleToPatient: true,
    },
    onSubmit: async ({ value }) => {
      if (!user?.uuid) return;
      mutate({
        patientId,
        ...value,
        uploadedBy: user.uuid,
        fileUrl: value.fileUrl || 'https://example.com/dummy-file.pdf', // Fallback for testing
      }, {
        onSuccess: () => setOpen(false)
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><FileUp size={14} className="mr-2" /> Upload File</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }} className="space-y-4 pt-4">
          
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="documentType">
              {(field) => (
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as DocumentType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(DocumentType).map(v => (
                        <SelectItem key={v} value={v} className="capitalize">{v.replace(/_/g, ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>

            <form.Field name="toothNumber">
              {(field) => (
                <div className="space-y-2">
                  <Label>Tooth # (Optional)</Label>
                  <Input value={field.state.value} onChange={e => field.handleChange(e.target.value)} placeholder="e.g. 14, 26" />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="fileName">
            {(field) => (
              <div className="space-y-2">
                <Label>File Name / Description</Label>
                <Input value={field.state.value} onChange={e => field.handleChange(e.target.value)} required placeholder="e.g. Pre-op X-Ray" />
              </div>
            )}
          </form.Field>

          <form.Field name="fileUrl">
            {(field) => (
              <div className="space-y-2">
                <Label>File URL (Simulated Upload)</Label>
                <Input value={field.state.value} onChange={e => field.handleChange(e.target.value)} placeholder="https://..." />
                <p className="text-xs text-muted-foreground">In a real app, this would be a file input that uploads to S3 and returns a URL.</p>
              </div>
            )}
          </form.Field>

          <form.Field name="notes">
            {(field) => (
              <div className="space-y-2">
                <Label>Clinical Notes</Label>
                <Textarea 
                  value={field.state.value} 
                  onChange={e => field.handleChange(e.target.value)}
                  className="h-20 resize-none"
                  placeholder="Observations..."
                />
              </div>
            )}
          </form.Field>

          <form.Field name="isVisibleToPatient">
            {(field) => (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="isVisibleToPatient" 
                  checked={field.state.value} 
                  onCheckedChange={v => field.handleChange(!!v)} 
                />
                <Label htmlFor="isVisibleToPatient" className="text-sm font-normal">
                  Visible to patient in their portal
                </Label>
              </div>
            )}
          </form.Field>

          <div className="flex justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="mr-2">Cancel</Button>
            <Button type="submit" disabled={isPending || !form.state.values.fileName}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
