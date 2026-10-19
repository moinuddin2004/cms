import { useRef } from 'react'
import { ExternalLink, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Shows a generated PDF inside the app with a Print button — no blank pop-up
 * tab, nothing for the browser's pop-up blocker to stop.
 */
export function PdfPreviewDialog({
  url,
  title,
  onClose,
}: {
  url: string | null
  title: string
  onClose: () => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)

  const print = () => {
    try {
      frame.current?.contentWindow?.focus()
      frame.current?.contentWindow?.print()
    } catch {
      if (url) window.open(url, '_blank')
    }
  }

  return (
    <Dialog open={!!url} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col gap-3 p-4 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-xs">
            Check it, then print or open it in a new tab.
          </DialogDescription>
        </DialogHeader>
        {url && (
          <iframe
            ref={frame}
            src={url}
            title={title}
            className="min-h-0 w-full flex-1 rounded-md border border-border bg-muted"
          />
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9" asChild>
            <a href={url ?? undefined} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> Open in new tab
            </a>
          </Button>
          <Button className="h-9 px-4" onClick={print}>
            <Printer className="size-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
