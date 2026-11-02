import { useId } from 'react'
import { Eraser, MousePointerClick, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { TooltipButton } from '@/components/shared/TooltipButton'
import {
  CONDITIONS,
  TOOTH_TOOLS,
  findingLabel,
  findingsOf,
  hasSurfaces,
  surfaceName,
  surfacesOf,
  toothName,
} from '../../utils/teethChart'
import type {
  ChartCondition,
  Finding,
  Surface,
  ToothEntry,
} from '../../utils/teethChart'
import { toothGeo } from '../../utils/odontogramGeometry'
import { OdontogramDefs, ToothGlyph } from './ToothGlyph'
import { ConditionDot } from './ChartToolbar'

/** The selected tooth, enlarged, with its surfaces, findings and note. */
export function ToothDetailPanel({
  tooth,
  entry,
  readOnly,
  onCycleSurface,
  onApply,
  onRemove,
  onTogglePlanned,
  onNote,
  onClear,
}: {
  tooth: number | null
  entry?: ToothEntry
  readOnly?: boolean
  onCycleSurface?: (s: Surface) => void
  onApply?: (c: ChartCondition) => void
  onRemove?: (f: Finding) => void
  onTogglePlanned?: (f: Finding) => void
  onNote?: (note: string) => void
  onClear?: () => void
}) {
  const prefix = `odp${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  if (tooth === null) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 p-4 text-center">
        <MousePointerClick className="size-6 text-muted-foreground/60" />
        <p className="text-sm font-medium">Select a tooth</p>
        <p className="max-w-[220px] text-xs text-muted-foreground">
          {readOnly
            ? 'Click any tooth to see its surfaces, findings and note.'
            : 'Click a tooth to chart it here surface by surface, or pick a condition above and click straight on the chart.'}
        </p>
      </div>
    )
  }

  const g = toothGeo(tooth)
  const w = g.rawW
  const d = g.rawD
  const sc = Math.min(3, 66 / w, 58 / d)
  const findings = findingsOf(entry)
  const surfacesApply = hasSurfaces(entry)
  const lab = (x: number, y: number, t: string) => (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={12}
      className="fill-muted-foreground font-semibold select-none"
    >
      {t}
    </text>
  )

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-none tabular-nums">
            {tooth}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {toothName(tooth)}
          </p>
        </div>
        {!readOnly && findings.length + (entry?.note ? 1 : 0) > 0 && (
          <TooltipButton
            tooltip="Clear this tooth"
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            onClick={onClear}
          >
            <Eraser className="size-4" />
          </TooltipButton>
        )}
      </div>

      {/* Enlarged tooth: buccal side on top. */}
      <svg
        viewBox="0 0 200 150"
        className="mx-auto block w-full max-w-[220px]"
        aria-hidden
      >
        <OdontogramDefs prefix={prefix} />
        <g transform={`translate(100 72) rotate(180) scale(${sc})`}>
          <ToothGlyph
            tooth={tooth}
            w={w}
            d={d}
            mesialSign={g.mesialSign}
            entry={entry}
            prefix={prefix}
            interactive={!readOnly}
            onSurface={readOnly ? undefined : (s) => s && onCycleSurface?.(s)}
          />
        </g>
        {surfacesApply && (
          <>
            {lab(100, 72 - (sc * d) / 2 - 8, 'B')}
            {lab(100, 72 + (sc * d) / 2 + 17, 'L')}
            {lab(100 - g.mesialSign * ((sc * w) / 2 + 13), 76, 'M')}
            {lab(100 + g.mesialSign * ((sc * w) / 2 + 13), 76, 'D')}
          </>
        )}
      </svg>

      {surfacesApply && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Surfaces
            {!readOnly && (
              <span className="font-normal">
                {' '}
                · tap: caries → filled → clear
              </span>
            )}
          </p>
          <div className="grid grid-cols-5 gap-1">
            {surfacesOf(tooth).map((s) => {
              const mark = entry?.surfaces?.[s]
              const tip = `${surfaceName(tooth, s)}${
                mark
                  ? ` · ${CONDITIONS[mark.condition].label}${mark.planned ? ' (planned)' : ''}`
                  : ''
              }`
              const content = (
                <span className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      'size-3 rounded-full border',
                      mark
                        ? CONDITIONS[mark.condition].dot
                        : 'border-muted-foreground/40',
                      mark?.planned && 'border-dashed bg-transparent',
                    )}
                  />
                  <span className="text-xs font-semibold">{s}</span>
                </span>
              )
              return readOnly ? (
                <div
                  key={s}
                  title={tip}
                  className="flex h-12 items-center justify-center rounded-md border bg-background"
                >
                  {content}
                </div>
              ) : (
                <TooltipButton
                  key={s}
                  tooltip={tip}
                  type="button"
                  variant="outline"
                  className="h-12 px-0"
                  onClick={() => onCycleSurface?.(s)}
                >
                  {content}
                </TooltipButton>
              )
            })}
          </div>
        </div>
      )}

      {!readOnly && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Whole tooth
          </p>
          <div className="flex flex-wrap gap-1">
            {TOOTH_TOOLS.map((c) => {
              const on =
                c === 'ROOT_CANAL' ? !!entry?.rootCanal : entry?.condition === c
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onApply?.(c)}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors',
                    on
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <ConditionDot condition={c} className="size-2" />
                  {CONDITIONS[c].label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
          Findings
        </p>
        {findings.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Healthy — nothing charted.
          </p>
        ) : (
          <ul className="space-y-1">
            {findings.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs"
              >
                <ConditionDot condition={f.condition} planned={f.planned} />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {findingLabel(f)}
                </span>
                {readOnly || CONDITIONS[f.condition].alwaysPlanned ? (
                  <StatusPill planned={f.planned} />
                ) : (
                  <TooltipButton
                    tooltip={f.planned ? 'Mark as existing' : 'Mark as planned'}
                    type="button"
                    variant="ghost"
                    className="h-auto p-0 hover:bg-transparent"
                    onClick={() => onTogglePlanned?.(f)}
                  >
                    <StatusPill planned={f.planned} interactive />
                  </TooltipButton>
                )}
                {!readOnly && (
                  <TooltipButton
                    tooltip="Remove finding"
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground"
                    onClick={() => onRemove?.(f)}
                  >
                    <X className="size-3.5" />
                  </TooltipButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
          Note
        </p>
        {readOnly ? (
          <p className="text-xs whitespace-pre-wrap text-muted-foreground">
            {entry?.note || 'No note.'}
          </p>
        ) : (
          <Textarea
            value={entry?.note ?? ''}
            onChange={(e) => onNote?.(e.target.value)}
            placeholder={`Note for tooth ${tooth}`}
            className="min-h-16 resize-none bg-background text-xs"
            maxLength={500}
          />
        )}
      </div>
    </div>
  )
}

export function StatusPill({
  planned,
  interactive,
}: {
  planned: boolean
  interactive?: boolean
}) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        planned
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
          : 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
        interactive && 'cursor-pointer hover:ring-1 hover:ring-border',
      )}
    >
      {planned ? 'Planned' : 'Existing'}
    </span>
  )
}
