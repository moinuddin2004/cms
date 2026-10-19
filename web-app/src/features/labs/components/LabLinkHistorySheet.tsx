import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useLabLinkHistory } from '../hooks/useLabLinks'
import type { LabLink } from '../types'
import { ActivityTimeline } from './ActivityTimeline'

/** Who added, activated, suspended or edited this lab — newest first. */
export function LabLinkHistorySheet({
  link,
  onOpenChange,
}: {
  link: LabLink | null
  onOpenChange: (open: boolean) => void
}) {
  const history = useLabLinkHistory(link?.id ?? null)
  return (
    <Sheet open={!!link} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border-soft px-6 py-5">
          <SheetTitle className="text-[17px] font-bold">
            {link?.lab.name} — history
          </SheetTitle>
          <SheetDescription className="text-[13px] text-text-3">
            Every status change and edit, with who made it.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <ActivityTimeline
            entries={history.data}
            isLoading={history.isLoading}
            isError={history.isError}
            onRetry={() => void history.refetch()}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
