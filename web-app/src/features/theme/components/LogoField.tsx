import { useRef } from 'react'
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import { useUploadLogo } from '../hooks/useThemeQueries'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'
const MAX_MB = 2

/**
 * Logo / icon picker: uploads through `/uploads` and stores the URL. An
 * empty value means "not set here" — `placeholderUrl` shows what applies.
 */
export function LogoField({
  id,
  value,
  onChange,
  disabled,
  dark,
  placeholderUrl,
}: {
  id: string
  value: string
  onChange: (url: string) => void
  disabled?: boolean
  /** Preview on a dark tile (dark-mode logo). */
  dark?: boolean
  placeholderUrl?: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadLogo()
  const shown = value || placeholderUrl || null

  const pick = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Images must be at most ${MAX_MB} MB`)
      return
    }
    const url = await upload.mutateAsync(file).catch(() => null)
    if (url) onChange(url)
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border',
          dark ? 'bg-slate-900' : 'bg-panel',
        )}
      >
        {shown ? (
          <img
            src={shown}
            alt=""
            className={cn(
              'max-h-12 max-w-12 object-contain',
              !value && 'opacity-50',
            )}
          />
        ) : (
          <ImageIcon className="size-5 text-text-3" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {value ? 'Replace' : 'Upload'}
          </Button>
          {value && (
            <TooltipButton
              type="button"
              variant="ghost"
              size="icon"
              tooltip="Remove"
              disabled={disabled || upload.isPending}
              onClick={() => onChange('')}
            >
              <Trash2 className="size-4" />
            </TooltipButton>
          )}
        </div>
        <span className="text-xs text-text-3">
          PNG, JPG, WebP or GIF, up to {MAX_MB} MB
          {!value && placeholderUrl ? ' · showing the inherited one' : ''}
        </span>
      </div>
      <Input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT}
        className="hidden"
        tabIndex={-1}
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
