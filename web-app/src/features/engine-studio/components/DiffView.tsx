import type { ReactNode } from 'react'
import { Minus, Pencil, Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { formatValue } from '../lib/diff'
import type { ListDiff } from '../lib/diff'
import type { VersionRow } from '../types'

/** Base / compare version pickers above a diff. */
export function VersionPickers({
  versions,
  baseId,
  targetId,
  onBase,
  onTarget,
}: {
  versions: VersionRow[]
  baseId: string
  targetId: string
  onBase: (id: string) => void
  onTarget: (id: string) => void
}) {
  const rows = [...versions].sort((a, b) => a.versionNo - b.versionNo)
  const picker = (
    label: string,
    value: string,
    onChange: (id: string) => void,
  ) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-44" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {rows.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            v{v.versionNo} · {v.status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {picker('Base version', baseId, onBase)}
      <span className="text-text-3">→</span>
      {picker('Compare version', targetId, onTarget)}
    </div>
  )
}

/** Added / removed / changed rows of one list (fields, states, transitions). */
export function DiffSection<T>({
  title,
  diff,
  describe,
}: {
  title: string
  diff: ListDiff<T>
  /** One-line description of an added / removed item. */
  describe: (item: T) => ReactNode
}) {
  const empty =
    !diff.added.length && !diff.removed.length && !diff.changed.length
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {empty ? (
        <p className="text-sm text-text-3">No changes.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
          {diff.added.map((item, i) => (
            <li key={`a-${i}`} className="flex gap-2 px-3 py-2">
              <Plus className="mt-0.5 size-4 shrink-0 text-emerald" />
              <span className="sr-only">Added</span>
              <div className="min-w-0">{describe(item)}</div>
            </li>
          ))}
          {diff.removed.map((item, i) => (
            <li key={`r-${i}`} className="flex gap-2 px-3 py-2">
              <Minus className="mt-0.5 size-4 shrink-0 text-danger" />
              <span className="sr-only">Removed</span>
              <div className="min-w-0 text-text-2 line-through">
                {describe(item)}
              </div>
            </li>
          ))}
          {diff.changed.map((c) => (
            <li key={`c-${c.key}`} className="flex gap-2 px-3 py-2">
              <Pencil className="mt-0.5 size-4 shrink-0 text-amber" />
              <span className="sr-only">Changed</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.label}</p>
                <table className="mt-1 w-full text-xs">
                  <tbody>
                    {c.changes.map((p) => (
                      <tr key={p.prop} className="align-top">
                        <td className="w-32 py-0.5 pr-2 font-mono text-text-3">
                          {p.prop}
                        </td>
                        <td className="py-0.5 pr-2 text-danger">
                          <span className="break-all">
                            {formatValue(p.before)}
                          </span>
                        </td>
                        <td className="py-0.5 text-emerald">
                          <span className="break-all">
                            {formatValue(p.after)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
