import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { FieldWrapper } from '@/components/shared'
import { NAV_ITEMS } from '@/features/access'
import type { NavItemDef } from '@/features/access'

const NONE = '__none__'

/** Unique sidebar pages a role can land on (super-admin / lab pages left out). */
export const HOME_OPTIONS: { href: string; label: string }[] = (() => {
  const seen = new Set<string>()
  const out: { href: string; label: string }[] = []
  for (const item of Object.values(NAV_ITEMS) as NavItemDef[]) {
    if (item.superAdminOnly || item.labMember || seen.has(item.href)) continue
    seen.add(item.href)
    out.push({ href: item.href, label: item.label })
  }
  return out
})()

/** Where members of the role land after signing in. */
export function HomePageTab({
  homeRoute,
  onChange,
  readOnly,
}: {
  homeRoute: string | null
  onChange: (route: string | null) => void
  readOnly: boolean
}) {
  const known = !homeRoute || HOME_OPTIONS.some((o) => o.href === homeRoute)
  return (
    <div className="max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h3 className="text-lg font-medium">Home page</h3>
        <p className="text-sm text-text-3">
          Members of this role open this page after signing in. If they can't
          see it, they land on the dashboard.
        </p>
      </div>
      <FieldWrapper label="Page" htmlFor="role-home">
        <Select
          value={homeRoute ?? NONE}
          disabled={readOnly}
          onValueChange={(v) => onChange(v === NONE ? null : v)}
        >
          <SelectTrigger id="role-home" aria-label="Home page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Default (dashboard)</SelectItem>
            {!known && homeRoute && (
              <SelectItem value={homeRoute}>{homeRoute}</SelectItem>
            )}
            {HOME_OPTIONS.map((o) => (
              <SelectItem key={o.href} value={o.href}>
                {o.label} — {o.href}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldWrapper>
    </div>
  )
}
