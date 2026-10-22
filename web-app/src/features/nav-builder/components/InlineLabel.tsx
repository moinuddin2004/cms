import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MAX_LABEL } from '../lib/builder-state'

/** A label with an inline rename: Enter / blur saves, Escape cancels. */
export function InlineLabel({
  value,
  placeholder,
  renameLabel,
  onCommit,
  className,
}: {
  value: string
  /** Shown (muted) when the value is empty. */
  placeholder: string
  /** Tooltip + accessible name of the rename button. */
  renameLabel: string
  onCommit: (label: string) => void
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (editing) {
    const commit = () => {
      setEditing(false)
      if (draft.trim() !== value) onCommit(draft)
    }
    return (
      <Input
        autoFocus
        value={draft}
        maxLength={MAX_LABEL}
        aria-label={renameLabel}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            setEditing(false)
          }
        }}
        className="h-7 min-w-0 flex-1 text-sm"
      />
    )
  }

  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-1', className)}>
      <span
        className={cn('truncate', !value && 'italic text-muted-foreground')}
        onDoubleClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        {value || placeholder}
      </span>
      <TooltipButton
        type="button"
        variant="ghost"
        size="icon"
        tooltip={renameLabel}
        className="size-7 shrink-0 text-muted-foreground"
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
      >
        <Pencil className="size-3.5" />
      </TooltipButton>
    </div>
  )
}
