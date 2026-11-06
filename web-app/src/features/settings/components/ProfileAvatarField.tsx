import { useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TooltipButton } from '@/components/shared/TooltipButton'
import {
  AVATAR_ACCEPT,
  avatarFileError,
  useRemoveAvatar,
  useUploadAvatar,
} from '../hooks/useProfileAvatar'

function initials(name?: string) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface ProfileAvatarFieldProps {
  name?: string
  avatarUrl?: string
}

/** The signed-in user's photo with Change / Remove actions. */
export function ProfileAvatarField({
  name,
  avatarUrl,
}: ProfileAvatarFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const upload = useUploadAvatar()
  const remove = useRemoveAvatar()
  const busy = upload.isPending || remove.isPending

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    const error = avatarFileError(file)
    if (error) {
      toast.error(error)
      return
    }
    upload.mutate(file)
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-14">
        {avatarUrl && (
          <AvatarImage
            src={avatarUrl}
            alt={name ?? 'Profile photo'}
            className="object-cover"
          />
        )}
        <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1.5">
        <Input
          ref={inputRef}
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          onChange={onPick}
          aria-label="Choose profile photo"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
          {avatarUrl ? 'Change photo' : 'Upload photo'}
        </Button>
        {avatarUrl && (
          <TooltipButton
            tooltip="Remove photo"
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" />
          </TooltipButton>
        )}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove profile photo?"
        description="Your initials will be shown instead. You can upload a new photo any time."
        confirmLabel="Remove"
        destructive
        isLoading={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, { onSettled: () => setConfirmOpen(false) })
        }
      />
    </div>
  )
}
