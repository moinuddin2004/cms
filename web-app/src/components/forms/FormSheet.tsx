import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  /** Custom footer; if omitted, a Cancel + submit footer is rendered. */
  footer?: ReactNode
  onSubmit?: () => void
  submitLabel?: string
  cancelLabel?: string
  isSubmitting?: boolean
  submitDisabled?: boolean
  /** Tailwind width class for the panel. */
  widthClassName?: string
  side?: 'left' | 'right'
}

/**
 * Slide-over panel that hosts a form. Header (title + description),
 * scrollable body, sticky footer with Cancel + primary submit — matching the
 * MedTrackr dialog anatomy but as a side sheet (per project rules).
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isSubmitting,
  submitDisabled,
  widthClassName = 'sm:max-w-xl',
  side = 'right',
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn('w-full gap-0 p-0', widthClassName)}
      >
        <SheetHeader className="border-b border-border-soft px-6 py-5">
          <SheetTitle className="text-[17px] font-bold">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-[13px] text-text-3">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        <div className="flex items-center justify-end gap-2.5 border-t border-border-soft bg-panel px-6 py-4">
          {footer ?? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting || submitDisabled}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {submitLabel}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Uppercase section eyebrow used to group fields inside a form. */
export function FormSection({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-3.5', className)}>
      <div className="text-xs font-bold uppercase tracking-[0.06em] text-text-3">
        {title}
      </div>
      {children}
    </div>
  )
}
