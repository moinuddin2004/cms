import { cn } from '@/lib/utils'
import {
  CONDITIONS,
  hasSurfaces,
  isAnterior,
  toothKind,
} from '../../utils/teethChart'
import type {
  ChartCondition,
  Surface,
  ToothEntry,
} from '../../utils/teethChart'
import {
  centerPath,
  groovePath,
  outlinePath,
  sideSurface,
  sideWedges,
} from '../../utils/odontogramGeometry'

const NS = { vectorEffect: 'non-scaling-stroke' } as const

/**
 * Hatch patterns for planned findings. Render once inside every <svg> that
 * draws teeth, with the same `prefix` passed to its glyphs.
 */
export function OdontogramDefs({ prefix }: { prefix: string }) {
  return (
    <defs>
      {(Object.keys(CONDITIONS) as ChartCondition[]).map((c) => (
        <pattern
          key={c}
          id={`${prefix}-hatch-${c}`}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="5" height="5" className={ENAMEL} />
          <rect width="2.4" height="5" className={CONDITIONS[c].fill} />
        </pattern>
      ))}
    </defs>
  )
}

/** Unmarked tooth surface. */
const ENAMEL = 'fill-white dark:fill-slate-700'

const hatch = (prefix: string, c: ChartCondition) =>
  `url(#${prefix}-hatch-${c})`

/** Solid fill for existing work, hatched for planned. */
function markFill(prefix: string, c: ChartCondition, planned?: boolean) {
  return planned
    ? { fill: hatch(prefix, c), className: undefined }
    : { fill: undefined, className: CONDITIONS[c].fill }
}

/**
 * One tooth seen from above, centred on (0,0), split into five clickable
 * surfaces with whole-tooth overlays (crown, implant, root canal, extraction,
 * missing). `onSurface(null)` = the whole tooth was clicked.
 */
export function ToothGlyph({
  tooth,
  w,
  d,
  mesialSign,
  entry,
  prefix,
  selected,
  interactive,
  onSurface,
  onHover,
}: {
  tooth: number
  w: number
  d: number
  mesialSign: number
  entry?: ToothEntry
  prefix: string
  selected?: boolean
  interactive?: boolean
  onSurface?: (surface: Surface | null) => void
  onHover?: (surface: Surface | null) => void
}) {
  const outline = outlinePath(toothKind(tooth), w, d)
  const center = centerPath(tooth, w, d)
  const condition = entry?.condition
  const planned = !!entry?.planned
  const dash = (p?: boolean) => (p ? '3 2' : undefined)

  const click = (s: Surface | null) =>
    onSurface
      ? (e: React.MouseEvent) => {
          e.stopPropagation()
          onSurface(s)
        }
      : undefined
  const hover = (s: Surface | null) => (onHover ? () => onHover(s) : undefined)

  const halo = selected && (
    <path
      d={outline}
      transform="scale(1.26)"
      className="fill-none stroke-foreground"
      strokeWidth={1.3}
      strokeDasharray="3 2"
      pointerEvents="none"
      {...NS}
    />
  )

  if (!hasSurfaces(entry)) {
    const r = Math.min(w, d) * 0.36
    return (
      <>
        <path
          d={outline}
          className="fill-transparent stroke-slate-400"
          strokeWidth={1.1}
          strokeDasharray="3 2"
          opacity={0.7}
          onClick={click(null)}
          onMouseEnter={hover(null)}
          {...NS}
        />
        {condition === 'IMPLANT' && (
          <g onClick={click(null)} onMouseEnter={hover(null)}>
            <circle
              r={r}
              fill={planned ? hatch(prefix, 'IMPLANT') : undefined}
              className={cn(!planned && 'fill-teal-500/25', 'stroke-teal-700')}
              strokeDasharray={dash(planned)}
              strokeWidth={1.4}
              {...NS}
            />
            <path
              d={`M${-r * 0.7} ${-r * 0.4} L${r * 0.7} ${-r * 0.4} M${-r * 0.85} 0 L${r * 0.85} 0 M${-r * 0.7} ${r * 0.4} L${r * 0.7} ${r * 0.4}`}
              className="stroke-teal-700"
              strokeWidth={1}
              pointerEvents="none"
              {...NS}
            />
          </g>
        )}
        {halo}
      </>
    )
  }

  const surfaceProps = (s: Surface) => {
    const mark = entry?.surfaces?.[s]
    const base = mark
      ? markFill(prefix, mark.condition, mark.planned)
      : {
          className: cn(
            ENAMEL,
            interactive &&
              'transition-colors hover:fill-slate-200 dark:hover:fill-slate-500',
          ),
        }
    return {
      ...base,
      className: cn(
        base.className,
        'stroke-slate-300 dark:stroke-slate-500',
        interactive && mark && 'hover:opacity-80',
      ),
      strokeWidth: 0.8,
      onClick: click(s),
      onMouseEnter: hover(s),
      ...NS,
    }
  }
  const groove = groovePath(tooth, w, d)
  const centerSurface: Surface = isAnterior(tooth) ? 'I' : 'O'
  const clipId = `${prefix}-clip-${tooth}`

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <path d={outline} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {sideWedges(w, d).map(([side, points]) => {
          const s = sideSurface(side, mesialSign)
          return <polygon key={side} points={points} {...surfaceProps(s)} />
        })}
      </g>
      <path d={center} {...surfaceProps(centerSurface)} />
      {groove && (
        <path
          d={groove}
          className="fill-none stroke-slate-300 dark:stroke-slate-500"
          strokeWidth={0.7}
          pointerEvents="none"
          {...NS}
        />
      )}
      <path
        d={outline}
        className="fill-none stroke-slate-400 dark:stroke-slate-300"
        strokeWidth={1.2}
        pointerEvents="none"
        {...NS}
      />

      {condition === 'CROWN' && (
        <>
          <path
            d={outline}
            fill={planned ? hatch(prefix, 'CROWN') : undefined}
            className={cn(
              !planned && CONDITIONS.CROWN.fill,
              'stroke-violet-700',
              interactive && 'hover:opacity-90',
            )}
            strokeWidth={1.4}
            strokeDasharray={dash(planned)}
            onClick={click(null)}
            onMouseEnter={hover(null)}
            {...NS}
          />
          <path
            d={center}
            className="fill-none stroke-violet-200"
            strokeWidth={0.8}
            pointerEvents="none"
            {...NS}
          />
        </>
      )}

      {entry?.rootCanal && (
        <circle
          r={Math.min(w, d) * 0.14}
          fill={
            entry.rootCanal.planned ? hatch(prefix, 'ROOT_CANAL') : undefined
          }
          className={cn(
            !entry.rootCanal.planned && CONDITIONS.ROOT_CANAL.fill,
            'stroke-amber-700',
          )}
          strokeWidth={1.1}
          strokeDasharray={dash(entry.rootCanal.planned)}
          pointerEvents="none"
          {...NS}
        />
      )}

      {condition === 'EXTRACTION_NEEDED' && (
        <path
          d={`M${-w * 0.55} ${-d * 0.55} L${w * 0.55} ${d * 0.55} M${w * 0.55} ${-d * 0.55} L${-w * 0.55} ${d * 0.55}`}
          className="stroke-orange-600"
          strokeWidth={2.4}
          strokeLinecap="round"
          pointerEvents="none"
          {...NS}
        />
      )}
      {halo}
    </>
  )
}
