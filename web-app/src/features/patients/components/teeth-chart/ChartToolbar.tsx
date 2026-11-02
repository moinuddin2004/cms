import { MousePointer2, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TooltipButton } from '@/components/shared/TooltipButton'
import {
  CONDITIONS,
  SURFACE_CONDITIONS,
  TOOTH_TOOLS,
} from '../../utils/teethChart'
import type { ChartCondition, Dentition } from '../../utils/teethChart'

export type ChartTool = ChartCondition | 'SELECT'

const TOOL_HINT: Record<ChartTool, string> = {
  SELECT: 'Click a tooth to see and edit its details',
  CARIES: 'Click the surfaces that have caries',
  FILLED: 'Click the surfaces that are filled',
  CROWN: 'Click a tooth to mark a crown',
  ROOT_CANAL: 'Click a tooth to mark a root canal',
  IMPLANT: 'Click a tooth to mark an implant',
  EXTRACTION_NEEDED: 'Click a tooth that needs extraction (always planned)',
  MISSING: 'Click a tooth that is missing',
}

export const toolHint = (t: ChartTool) => TOOL_HINT[t]

export function ConditionDot({
  condition,
  planned,
  className,
}: {
  condition: ChartCondition
  planned?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full border',
        CONDITIONS[condition].dot,
        planned && 'border-dashed bg-transparent',
        className,
      )}
    />
  )
}

/** Small segmented control (two or three options). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode; badge?: number }[]
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-md border bg-muted/40 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1 text-xs font-medium transition-colors',
            value === o.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
          {!!o.badge && (
            <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary tabular-nums">
              {o.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function ToolChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-all',
        active
          ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
          : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Chart controls: which teeth (permanent/primary), what a click marks
 * (existing/planned), and the tool — select, a surface condition or a
 * whole-tooth condition.
 */
export function ChartToolbar({
  tool,
  onTool,
  planned,
  onPlanned,
  dentition,
  onDentition,
  otherDentitionCount,
  canUndo,
  onUndo,
}: {
  tool: ChartTool
  onTool: (t: ChartTool) => void
  planned: boolean
  onPlanned: (p: boolean) => void
  dentition: Dentition
  onDentition: (d: Dentition) => void
  /** Findings charted on the arch that isn't shown. */
  otherDentitionCount: number
  canUndo: boolean
  onUndo: () => void
}) {
  const plannedLocked = tool !== 'SELECT' && !!CONDITIONS[tool].alwaysPlanned
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="Teeth"
          value={dentition}
          onChange={onDentition}
          options={[
            {
              value: 'permanent',
              label: 'Permanent',
              badge: dentition === 'primary' ? otherDentitionCount : 0,
            },
            {
              value: 'primary',
              label: 'Primary (child)',
              badge: dentition === 'permanent' ? otherDentitionCount : 0,
            },
          ]}
        />
        <div className="flex items-center gap-2">
          <Segmented
            label="Mark as"
            value={plannedLocked || planned ? 'planned' : 'existing'}
            onChange={(v) => onPlanned(v === 'planned')}
            options={[
              { value: 'existing', label: 'Existing' },
              { value: 'planned', label: 'Planned' },
            ]}
          />
          <TooltipButton
            tooltip="Undo (Ctrl+Z)"
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 className="size-4" />
          </TooltipButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ToolChip active={tool === 'SELECT'} onClick={() => onTool('SELECT')}>
          <MousePointer2 className="size-3.5" /> Select
        </ToolChip>
        <span className="mx-1 h-5 w-px bg-border" />
        <span className="text-[11px] font-medium text-muted-foreground">
          Surface
        </span>
        {SURFACE_CONDITIONS.map((c) => (
          <ToolChip key={c} active={tool === c} onClick={() => onTool(c)}>
            <ConditionDot condition={c} /> {CONDITIONS[c].label}
          </ToolChip>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <span className="text-[11px] font-medium text-muted-foreground">
          Whole tooth
        </span>
        {TOOTH_TOOLS.map((c) => (
          <ToolChip key={c} active={tool === c} onClick={() => onTool(c)}>
            <ConditionDot condition={c} /> {CONDITIONS[c].label}
          </ToolChip>
        ))}
      </div>
    </div>
  )
}
