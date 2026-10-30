import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, FileUp } from 'lucide-react'
import { DocumentType } from '../../types'
import { FileUploadField } from '@/components/shared/FileUploadField'
import { fieldError } from '@/components/forms/fieldError'
import { useDocumentForm } from '../../hooks/useDocumentForm'

export function DocumentFormDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false)
  const { form, isPending, isUploading } = useDocumentForm({
    patientId,
    onSaved: () => setOpen(false),
  })

  const busy = isPending || isUploading

  // The picker unmounts with the dialog, so drop the picked file with it.
  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o) form.resetField('file')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <FileUp size={14} className="mr-2" /> Upload File
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4 pt-4"
        >
          <form.Field name="file">
            {(field) => (
              <div className="space-y-2">
                <Label>
                  File <span className="text-destructive">*</span>
                </Label>
                <FileUploadField
                  onFileSelected={(f) => {
                    field.handleChange(f)
                    field.handleBlur()
                  }}
                  accept="image/*,application/pdf"
                  disabled={busy}
                />
                {fieldError(field) && (
                  <p className="text-xs font-medium text-danger">
                    {fieldError(field)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <div className="grid grid-cols-2 gap-4">
            <form.Field name="documentType">
              {(field) => (
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as DocumentType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(DocumentType).map((v) => (
                        <SelectItem key={v} value={v} className="capitalize">
                          {v.replace(/_/g, ' ')}
                        </SelectItem>
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
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="e.g. 14, 26"
                  />
                  {fieldError(field) && (
                    <p className="text-xs font-medium text-danger">
                      {fieldError(field)}
                    </p>
                  )}
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="fileName">
            {(field) => (
              <div className="space-y-2">
                <Label>Title / Description</Label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Defaults to the file name if left blank"
                />
                {fieldError(field) && (
                  <p className="text-xs font-medium text-danger">
                    {fieldError(field)}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="notes">
            {(field) => (
              <div className="space-y-2">
                <Label>Clinical Notes</Label>
                <Textarea
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
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
                  onCheckedChange={(v) => field.handleChange(!!v)}
                />
                <Label
                  htmlFor="isVisibleToPatient"
                  className="text-sm font-normal"
                >
                  Visible to patient in their portal
                </Label>
              </div>
            )}
          </form.Field>

          <div className="flex justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="mr-2"
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting || busy}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isUploading ? 'Uploading…' : 'Upload'}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
