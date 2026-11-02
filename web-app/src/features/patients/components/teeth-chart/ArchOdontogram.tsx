import { useId, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  ARCHES,
  CONDITIONS,
  entryOf,
  findingsOf,
  findingLabel,
  surfaceName,
  toothName,
} from '../../utils/teethChart'
import type { ChartData, Dentition, Surface } from '../../utils/teethChart'
import { ARCH_LAYOUT, ARCH_VIEWBOX } from '../../utils/odontogramGeometry'
import { OdontogramDefs, ToothGlyph } from './ToothGlyph'

export type ChartHover = { tooth: number; surface: Surface | null } | null

/**
 * Both jaws as U-shaped arches, each tooth split into five surfaces.
 * Arrow keys move between teeth (←/→ along the jaw, ↑/↓ to the other jaw).
 * Without `onSurfaceClick` the chart is read-only and clicks only select.
 */
export function ArchOdontogram({
  dentition,
  data,
  selected,
  onSelect,
  onSurfaceClick,
  onHover,
}: {
  dentition: Dentition
  data: ChartData
  selected: number | null
  onSelect: (tooth: number) => void
  onSurfaceClick?: (tooth: number, surface: Surface | null) => void
  onHover?: (hover: ChartHover) => void
}) {
  const prefix = `odo${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const refs = useRef(new Map<number, SVGGElement>())
  const layout = ARCH_LAYOUT[dentition]
  const { upper, lower } = ARCHES[dentition]
  const all = [...upper, ...lower]
  const focusable =
    selected !== null && selected in layout ? selected : upper[0]
  const vb = ARCH_VIEWBOX

  const press = (t: number, s: Surface | null) => {
    onSelect(t)
    onSurfaceClick?.(t, s)
  }

  const onKeyDown = (e: React.KeyboardEvent, t: number) => {
    const row = upper.includes(t) ? upper : lower
    const other = row === upper ? lower : upper
    const i = row.indexOf(t)
    let next: number | undefined
    if (e.key === 'ArrowRight') next = row[Math.min(i + 1, row.length - 1)]
    else if (e.key === 'ArrowLeft') next = row[Math.max(i - 1, 0)]
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const goUp = e.key === 'ArrowUp'
      if (goUp !== (row === upper)) next = other[i]
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      press(t, null)
      return
    }
    if (next !== undefined) {
      e.preventDefault()
      onSelect(next)
      refs.current.get(next)?.focus()
    }
  }

  const label = (
    x: number,
    y: number,
    anchor: 'start' | 'end',
    text: string,
  ) => (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={13}
      className="fill-muted-foreground select-none"
    >
      {text}
    </text>
  )

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className="mx-auto block h-auto w-full max-w-[680px] select-none"
      role="group"
      aria-label={`${dentition === 'primary' ? 'Primary' : 'Permanent'} teeth chart`}
      onMouseLeave={() => onHover?.(null)}
    >
      <OdontogramDefs prefix={prefix} />
      <line
        x1={300}
        y1={0}
        x2={300}
        y2={vb.h}
        className="stroke-border"
        strokeDasharray="4 4"
      />
      <line
        x1={80}
        y1={216}
        x2={520}
        y2={216}
        className="stroke-border"
        strokeDasharray="4 4"
      />
      {label(18, 18, 'start', 'Upper right')}
      {label(582, 18, 'end', 'Upper left')}
      {label(18, 418, 'start', 'Lower right')}
      {label(582, 418, 'end', 'Lower left')}
      <text
        x={300}
        y={dentition === 'permanent' ? 122 : 128}
        textAnchor="middle"
        fontSize={14}
        className="fill-muted-foreground/70 select-none"
      >
        Upper jaw
      </text>
      <text
        x={300}
        y={dentition === 'permanent' ? 322 : 316}
        textAnchor="middle"
        fontSize={14}
        className="fill-muted-foreground/70 select-none"
      >
        Lower jaw
      </text>

      {all.map((t) => {
        const g = layout[t]
        const entry = entryOf(data, t)
        const isSel = t === selected
        const findings = findingsOf(entry)
        const r = g.d / 2 + 13
        const lx = g.x + g.nx * r
        const ly = g.y + g.ny * r + 5
        return (
          <g key={t}>
            <g
              ref={(el) => {
                if (el) refs.current.set(t, el)
                else refs.current.delete(t)
              }}
              transform={`translate(${g.x.toFixed(2)} ${g.y.toFixed(2)}) rotate(${g.rotate.toFixed(2)})`}
              role="button"
              tabIndex={t === focusable ? 0 : -1}
              aria-pressed={isSel}
              aria-label={`Tooth ${t}, ${toothName(t)}${
                findings.length
                  ? `: ${findings.map((f) => findingLabel(f) + (f.planned ? ' planned' : '')).join(', ')}`
                  : ', no findings'
              }`}
              className="cursor-pointer outline-none"
              onClick={() => press(t, null)}
              onKeyDown={(e) => onKeyDown(e, t)}
              onMouseEnter={() => onHover?.({ tooth: t, surface: null })}
            >
              <ToothGlyph
                tooth={t}
                w={g.w}
                d={g.d}
                mesialSign={g.mesialSign}
                entry={entry}
                prefix={prefix}
                selected={isSel}
                interactive={!!onSurfaceClick}
                onSurface={(s) => press(t, s)}
                onHover={(s) => onHover?.({ tooth: t, surface: s })}
              />
            </g>
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              fontSize={15}
              className={cn(
                'cursor-pointer select-none tabular-nums',
                isSel
                  ? 'fill-foreground font-semibold'
                  : findings.length
                    ? 'fill-foreground/80 font-medium'
                    : 'fill-muted-foreground',
              )}
              onClick={() => onSelect(t)}
              onMouseEnter={() => onHover?.({ tooth: t, surface: null })}
            >
              {t}
            </text>
            {entry?.note && (
              <circle
                cx={lx + 12}
                cy={ly - 10}
                r={2.6}
                className="fill-primary"
                pointerEvents="none"
              >
                <title>Has a note</title>
              </circle>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** "16 · Upper right first molar · Distal surface · Caries (planned)" */
export function describeHover(h: ChartHover, data: ChartData): string | null {
  if (!h) return null
  const entry = entryOf(data, h.tooth)
  const parts = [`${h.tooth} · ${toothName(h.tooth)}`]
  if (h.surface) {
    const mark = entry?.surfaces?.[h.surface]
    parts.push(
      `${surfaceName(h.tooth, h.surface)} surface${
        mark
          ? ` · ${CONDITIONS[mark.condition].label}${mark.planned ? ' (planned)' : ''}`
          : ''
      }`,
    )
  } else {
    const f = findingsOf(entry)
    if (f.length)
      parts.push(
        f
          .map((x) => findingLabel(x) + (x.planned ? ' (planned)' : ''))
          .join(', '),
      )
  }
  return parts.join(' · ')
}
