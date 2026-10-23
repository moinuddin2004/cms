import { AlertTriangle, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { checkBrandContrast, isHexColor } from '../lib/color'

const PRESETS = [
  { hex: '#2563eb', name: 'Blue' },
  { hex: '#0d9488', name: 'Teal' },
  { hex: '#059669', name: 'Emerald' },
  { hex: '#7c3aed', name: 'Violet' },
  { hex: '#db2777', name: 'Pink' },
  { hex: '#dc2626', name: 'Red' },
  { hex: '#ea580c', name: 'Orange' },
  { hex: '#0f172a', name: 'Slate' },
]

/** Brand colour: picker + hex input + presets, with WCAG contrast warnings. */
export function BrandColorField({
  id,
  value,
  onChange,
  onBlur,
  disabled,
}: {
  id: string
  value: string
  onChange: (hex: string) => void
  onBlur?: () => void
  disabled?: boolean
}) {
  const valid = isHexColor(value)
  const check = valid ? checkBrandContrast(value) : null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="color"
          aria-label="Pick brand colour"
          value={valid ? value.toLowerCase() : '#2563eb'}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer p-1"
        />
        <Input
          id={id}
          value={value}
          disabled={disabled}
          maxLength={7}
          placeholder="#2563eb"
          onChange={(e) => onChange(e.target.value.trim())}
          onBlur={onBlur}
          className="w-28 font-mono uppercase"
        />
      </div>
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const selected = value.toLowerCase() === p.hex
            return (
              <Tooltip key={p.hex}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`${p.name} ${p.hex}`}
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => onChange(p.hex)}
                    className={cn(
                      'flex size-7 items-center justify-center rounded-md border border-border transition-transform hover:scale-110 disabled:opacity-50',
                      selected &&
                        'ring-2 ring-ring ring-offset-2 ring-offset-background',
                      SWATCH_CLASS[p.hex],
                    )}
                  >
                    {selected && <Check className="size-3.5 text-white" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">{p.name}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </TooltipProvider>
      {check && check.warnings.length > 0 && (
        <div
          role="status"
          className="flex gap-2 rounded-md border border-amber/40 bg-amber-soft p-2.5 text-xs text-amber"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <div className="space-y-1">
            {check.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        </div>
      )}
      {check && check.warnings.length === 0 && (
        <p className="text-xs text-text-3">
          Contrast OK — button text {check.buttonRatio.toFixed(1)}:1.
        </p>
      )}
    </div>
  )
}

// Swatches are fixed sample colours, not brand tokens.
const SWATCH_CLASS: Record<string, string> = {
  '#2563eb': 'bg-[#2563eb]',
  '#0d9488': 'bg-[#0d9488]',
  '#059669': 'bg-[#059669]',
  '#7c3aed': 'bg-[#7c3aed]',
  '#db2777': 'bg-[#db2777]',
  '#dc2626': 'bg-[#dc2626]',
  '#ea580c': 'bg-[#ea580c]',
  '#0f172a': 'bg-[#0f172a]',
}
