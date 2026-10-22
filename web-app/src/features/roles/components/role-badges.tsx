import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { roleTone } from '../lib/bundles'

/** Small color dot identifying a role. */
export function RoleDot({
  seed,
  className,
}: {
  seed: string
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full',
        roleTone(seed),
        className,
      )}
    />
  )
}

/** "System" (read-only template) or "Custom". */
export function RoleKindBadge({ isSystemRole }: { isSystemRole: boolean }) {
  return isSystemRole ? (
    <Badge variant="secondary" className="gap-1">
      <Lock className="size-3" /> System
    </Badge>
  ) : (
    <Badge variant="outline">Custom</Badge>
  )
}

/** Marks a `risk: 'high'` permission. */
export function HighRiskBadge() {
  return (
    <Badge variant="danger" className="px-1.5 py-0.5 text-[10px]">
      High risk
    </Badge>
  )
}
