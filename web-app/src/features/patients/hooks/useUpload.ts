import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { uploadFile  } from '../services/uploads.api'
import type {UploadedFileResult} from '../services/uploads.api';

/**
 * Upload a file through the backend storage abstraction.
 * Surfaces backend validation errors (type/size) as a toast.
 */
export function useUpload() {
  return useMutation<UploadedFileResult, any, { file: File; folder?: string }>({
    mutationFn: ({ file, folder }) => uploadFile(file, folder),
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'File upload failed')
    },
  })
}
