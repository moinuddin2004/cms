import { useState } from 'react'
import {
  Archive,
  CopyPlus,
  GitCompare,
  Loader2,
  PencilLine,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import { formatInClinic } from '@/lib/datetime'
import type { VersionRow } from '../types'
import { DefinitionStatusBadge } from './studio-badges'

const when = (iso: string | null) => formatInClinic(iso, 'd MMM yyyy, HH:mm')

/**
 * Every version of a form or workflow, newest first: open one in the
 * editor, compare it, start a new draft from it, or retire the published one.
 */
export function VersionsPanel({
  versions,
  selectedId,
  hasDraft,
  onOpen,
  onCompare,
  onNewDraft,
  onRetire,
  busy,
}: {
  versions: VersionRow[]
  selectedId?: string
  hasDraft: boolean
  onOpen: (versionId: string) => void
  onCompare: (versionId: string) => void
  onNewDraft: (fromVersionId: string) => void
  onRetire: (versionId: string, onDone: () => void) => void
  busy: boolean
}) {
  const [retiring, setRetiring] = useState<VersionRow | null>(null)
  const rows = [...versions].sort((a, b) => b.versionNo - a.versionNo)

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs text-text-3">
          <tr>
            <th className="px-4 py-2 font-medium">Version</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Created</th>
            <th className="px-4 py-2 font-medium">Published</th>
            <th className="px-4 py-2 font-medium">Retired</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr
              key={v.id}
              className={cn(
                'border-t border-border transition-colors hover:bg-accent/30',
                v.id === selectedId && 'bg-primary-soft/40',
              )}
            >
              <td className="px-4 py-2 font-medium tabular-nums">
                v{v.versionNo}
              </td>
              <td className="px-4 py-2">
                <DefinitionStatusBadge status={v.status} />
              </td>
              <td className="px-4 py-2 text-text-2">{when(v.createdAt)}</td>
              <td className="px-4 py-2 text-text-2">{when(v.publishedAt)}</td>
              <td className="px-4 py-2 text-text-2">{when(v.retiredAt)}</td>
              <td className="px-4 py-2">
                <div className="flex justify-end gap-1">
                  <TooltipButton
                    tooltip={`Open v${v.versionNo}`}
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onOpen(v.id)}
                  >
                    <PencilLine className="size-4" />
                  </TooltipButton>
                  <TooltipButton
                    tooltip={`Compare v${v.versionNo}`}
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={versions.length < 2}
                    onClick={() => onCompare(v.id)}
                  >
                    <GitCompare className="size-4" />
                  </TooltipButton>
                  {!hasDraft && (
                    <TooltipButton
                      tooltip={`New draft from v${v.versionNo}`}
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={busy}
                      onClick={() => onNewDraft(v.id)}
                    >
                      <CopyPlus className="size-4" />
                    </TooltipButton>
                  )}
                  {v.status === 'published' && (
                    <TooltipButton
                      tooltip={`Retire v${v.versionNo}`}
                      variant="ghost"
                      size="icon"
                      className="size-8 text-danger"
                      onClick={() => setRetiring(v)}
                    >
                      <Archive className="size-4" />
                    </TooltipButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {busy && (
        <p className="flex items-center gap-2 border-t border-border px-4 py-2 text-xs text-text-3">
          <Loader2 className="size-3.5 animate-spin" /> Working…
        </p>
      )}

      <ConfirmDialog
        open={!!retiring}
        onOpenChange={(o) => !o && setRetiring(null)}
        title={`Retire v${retiring?.versionNo}?`}
        description="New orders can no longer use this version until another one is published. Orders already pinned to it keep working."
        confirmLabel="Retire"
        destructive
        isLoading={busy}
        onConfirm={() =>
          retiring && onRetire(retiring.id, () => setRetiring(null))
        }
      />
    </div>
  )
}
