import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FolderOpen, Loader2, FileText } from 'lucide-react'
import { useDocuments } from '../../hooks/usePatientSubEntities'
import type { Patient, PatientDocument } from '../../types'
import { DocumentFormDialog } from './DocumentFormDialog'
import { formatDate } from '@/lib/datetime'

export function FilesTab({ patient }: { patient: Patient }) {
  const { data: documents = [], isLoading: loadingDocs } = useDocuments(
    patient.id,
  )

  return (
    <div className="mt-4 animate-in fade-in duration-300">
      <Card className="shadow-sm">
        <CardHeader className="pb-2 border-b flex flex-row items-center justify-between bg-muted/20">
          <CardTitle className="text-md flex items-center gap-2">
            <FolderOpen className="text-primary" size={16} />
            Patient Documents & Scans
          </CardTitle>
          <DocumentFormDialog patientId={patient.id} />
        </CardHeader>
        <CardContent className="pt-6">
          {loadingDocs ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="min-h-[150px] border-dashed border-2 rounded-lg flex flex-col items-center justify-center text-muted-foreground">
              <FolderOpen size={32} className="opacity-20 mb-2" />
              <p className="text-sm">No documents uploaded yet</p>
              <p className="text-xs mt-1">
                Upload X-Rays, Scans, and external lab reports
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <DocumentRow key={doc.id} document={doc} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DocumentRow({ document }: { document: PatientDocument }) {
  const isImage = document.mimeType?.startsWith('image/')
  return (
    <a
      href={document.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        {isImage && document.thumbnailUrl ? (
          <img
            src={document.thumbnailUrl}
            alt={document.fileName}
            className="h-10 w-10 rounded-md object-cover border"
          />
        ) : (
          <div className="p-2 bg-muted rounded-md">
            <FileText size={16} className="text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{document.fileName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              {document.documentType.replaceAll('_', ' ')}
            </Badge>
            {document.toothNumber && (
              <span className="text-[10px] text-muted-foreground">
                Tooth #{document.toothNumber}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {formatDate(document.createdAt)}
            </span>
          </div>
        </div>
      </div>
      {document.fileSizeBytes && (
        <span className="text-xs text-muted-foreground whitespace-nowrap pl-2">
          {document.fileSizeBytes < 1024 * 1024
            ? `${(document.fileSizeBytes / 1024).toFixed(0)} KB`
            : `${(document.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`}
        </span>
      )}
    </a>
  )
}
