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
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useCreateDocument } from '../../hooks/usePatientSubEntities'
import { useUpload } from '../../hooks/useUpload'
import { useAuthStore } from '@/store/useAuthStore'
import { Loader2, FileUp } from 'lucide-react'
import { DocumentType } from '../../types'
import { FileUploadField } from '@/components/shared/FileUploadField'

export function DocumentFormDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const { mutate, isPending } = useCreateDocument()
  const { mutateAsync: upload, isPending: isUploading } = useUpload()
  const { user } = useAuthStore()

  const form = useForm({
    defaultValues: {
      documentType: DocumentType.XRAY,
      fileName: '',
      notes: '',
      toothNumber: '',
      isVisibleToPatient: true,
    },
    onSubmit: async ({ value }) => {
      if (!user?.uuid) {
        toast.error('Your session is missing — please sign in again.')
        return
      }
      if (!file) {
        toast.error('Please choose a file to upload.')
        return
      }

      let uploaded
      try {
        uploaded = await upload({ file, folder: 'patient-documents' })
      } catch {
        return // toast already shown by useUpload
      }

      const isImage = uploaded.mimeType.startsWith('image/')
      mutate(
        {
          patientId,
          documentType: value.documentType,
          fileName: value.fileName.trim() || uploaded.fileName,
          fileUrl: uploaded.url,
          thumbnailUrl: isImage ? uploaded.url : undefined,
          fileSizeBytes: uploaded.sizeBytes,
          mimeType: uploaded.mimeType,
          notes: value.notes || undefined,
          toothNumber: value.toothNumber || undefined,
          isVisibleToPatient: value.isVisibleToPatient,
          uploadedBy: user.uuid,
        },
        {
          onSuccess: () => {
            form.reset()
            setFile(null)
            setOpen(false)
          },
        },
      )
    },
  })

  const busy = isPending || isUploading

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setFile(null)
      }}
    >
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
          <div className="space-y-2">
            <Label>
              File <span className="text-destructive">*</span>
            </Label>
            <FileUploadField
              onFileSelected={setFile}
              accept="image/*,application/pdf"
              disabled={busy}
            />
          </div>

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
                    placeholder="e.g. 14, 26"
                  />
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
                  placeholder="Defaults to the file name if left blank"
                />
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
              onClick={() => setOpen(false)}
              className="mr-2"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !file}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isUploading ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
