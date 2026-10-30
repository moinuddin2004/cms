import { useForm } from '@tanstack/react-form'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'
import { DocumentType } from '../types'
import { documentSchema } from '../schemas/patient-records.schema'
import type { DocumentFormValues } from '../schemas/patient-records.schema'
import { useCreateDocument } from './usePatientSubEntities'
import { useUpload } from './useUpload'

const defaultValues: DocumentFormValues = {
  file: null,
  documentType: DocumentType.XRAY,
  fileName: '',
  notes: '',
  toothNumber: '',
  isVisibleToPatient: true,
}

/** Upload a file, then record it as a patient document. */
export function useDocumentForm({
  patientId,
  onSaved,
}: {
  patientId: string
  onSaved: () => void
}) {
  const { mutate, isPending } = useCreateDocument()
  const { mutateAsync: upload, isPending: isUploading } = useUpload()
  const { user } = useAuthStore()

  const form = useForm({
    defaultValues,
    validators: { onChange: documentSchema, onSubmit: documentSchema },
    onSubmit: async ({ value }) => {
      if (!user?.uuid) {
        toast.error('Your session is missing — please sign in again.')
        return
      }
      const file = value.file
      if (!file) return // schema guarantees a file

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
            onSaved()
          },
        },
      )
    },
  })

  return { form, isPending, isUploading }
}
