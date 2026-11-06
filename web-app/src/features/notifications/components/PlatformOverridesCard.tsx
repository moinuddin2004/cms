import { ShieldCheck } from 'lucide-react'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/store/useAuthStore'
import {
  usePlatformOverrides,
  useSetPlatformOverride,
} from '../hooks/useNotificationSettings'
import type { PlatformOverride } from '../types'

const MODE_LABEL: Record<PlatformOverride['mode'], string> = {
  clinic: 'Clinic decides',
  on: 'Always on',
  off: 'Always off',
}

/**
 * Super admin only: for this clinic, force a mandatory event's email on or
 * off over the clinic's own switch — or leave it to the clinic. Mandatory
 * in-app notifications always stay on.
 */
export function PlatformOverridesCard() {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin)
  const orgId = useAuthStore((s) => s.activeOrganizationId)
  const list = usePlatformOverrides(orgId, isSuperAdmin)
  const save = useSetPlatformOverride(orgId)

  if (!isSuperAdmin || !orgId) return null

  return (
    <section className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <h2 className="text-lg font-medium">Mandatory emails (platform)</h2>
          <p className="text-sm text-text-3">
            Only super admins see this. “Always on / off” overrides the clinic’s
            own switch and locks it for the clinic; “Clinic decides” hands it
            back. In-app always stays on.
          </p>
        </div>
      </div>
      {list.isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : (
        <ul className="divide-y divide-border-soft rounded-md border border-border bg-surface">
          {list.data?.map((o) => (
            <li
              key={o.eventCode}
              className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-panel sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{o.name}</p>
                <p className="text-xs text-text-3">{o.description}</p>
              </div>
              <Select
                value={o.mode}
                disabled={save.isPending}
                onValueChange={(mode) =>
                  save.mutate({
                    eventCode: o.eventCode,
                    mode: mode as PlatformOverride['mode'],
                  })
                }
              >
                <SelectTrigger
                  className="h-9 w-full sm:w-44"
                  aria-label={`Email for ${o.name}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['clinic', 'on', 'off'] as const).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MODE_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
