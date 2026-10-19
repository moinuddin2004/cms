import { Wand2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { cn } from '@/lib/utils'
import { parseJson, toJsonText } from '../lib/form-preview'

/** Monospace JSON text box with a parse error line and a format button. */
export function JsonEditor({
  id,
  label,
  hint,
  value,
  onChange,
  readOnly = false,
  rows = 18,
}: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  rows?: number
}) {
  const parsed = parseJson(value)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {!readOnly && (
          <TooltipButton
            tooltip={`Format ${label}`}
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={!parsed.ok || !value.trim()}
            onClick={() => parsed.ok && onChange(toJsonText(parsed.value))}
          >
            <Wand2 className="size-3.5" />
          </TooltipButton>
        )}
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        rows={rows}
        aria-invalid={!parsed.ok}
        className={cn(
          'font-mono text-xs leading-relaxed',
          readOnly && 'bg-muted/40',
        )}
      />
      {!parsed.ok ? (
        <p className="text-xs text-danger" role="alert">
          Invalid JSON: {parsed.error}
        </p>
      ) : (
        hint && <p className="text-xs text-text-3">{hint}</p>
      )}
    </div>
  )
}
