import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** On / off switch with the mandatory tooltip, for archive-style toggles. */
export function ActiveSwitch({
  checked,
  disabled,
  label,
  onTooltip,
  offTooltip,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  /** Accessible name, e.g. "Zirconia crown is offered". */
  label: string
  onTooltip: string
  offTooltip: string
  onChange: (checked: boolean) => void
}) {
  return (
    <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Switch
                size="sm"
                checked={checked}
                disabled={disabled}
                aria-label={label}
                onCheckedChange={onChange}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {checked ? onTooltip : offTooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  )
}
