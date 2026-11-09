import { useRef, useState } from 'react'
import { UploadCloud, File as FileIcon, X, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadFieldProps {
  /** Called whenever the selection changes (null when cleared). */
  onFileSelected: (file: File | null) => void
  /** Accept attribute, e.g. "image/*,application/pdf". */
  accept?: string
  /** Max size in MB (client-side guard; backend enforces too). */
  maxSizeMb?: number
  disabled?: boolean
  className?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Drag-and-drop / click file picker. Selection only — uploading is the
 * caller's responsibility (so it can upload on submit and store the URL).
 * Shows an inline preview for images and a size/name chip otherwise.
 */
export function FileUploadField({
  onFileSelected,
  accept = 'image/*,application/pdf',
  maxSizeMb = 15,
  disabled,
  className,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const select = (f: File | null) => {
    setError(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)

    if (!f) {
      setFile(null)
      setPreviewUrl(null)
      onFileSelected(null)
      return
    }

    if (f.size > maxSizeMb * 1024 * 1024) {
      setError(`File exceeds ${maxSizeMb}MB limit`)
      return
    }

    setFile(f)
    setPreviewUrl(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
    onFileSelected(f)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = e.dataTransfer.files
    if (files.length > 0) select(files[0])
  }

  return (
    <div className={className}>
      {!file ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
            dragging
              ? 'border-brand-500 bg-brand-50/40'
              : 'border-border hover:border-brand-300 hover:bg-muted/30',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <UploadCloud size={28} className="text-muted-foreground" />
          <span className="text-sm font-medium">
            Click to upload or drag &amp; drop
          </span>
          <span className="text-xs text-muted-foreground">
            Images or PDF, up to {maxSizeMb}MB
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              className="h-12 w-12 rounded object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
              {file.type.startsWith('image/') ? (
                <ImageIcon size={18} className="text-muted-foreground" />
              ) : (
                <FileIcon size={18} className="text-muted-foreground" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(file.size)}
            </p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => select(null)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
            aria-label="Remove file"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => select(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}
