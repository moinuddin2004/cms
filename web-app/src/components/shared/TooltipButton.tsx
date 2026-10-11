import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type TooltipButtonProps = React.ComponentProps<typeof Button> & {
  /** Required: text shown on hover/focus. Also used as the accessible name for icon-only buttons. */
  tooltip: string
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
}

/**
 * The project-wide button. Every icon-only button MUST use this (or wrap in
 * <Tooltip>) so that it has a hover tooltip. See "Tooltips" in CLAUDE.md.
 */
export function TooltipButton({
  tooltip,
  tooltipSide = 'top',
  'aria-label': ariaLabel,
  ...props
}: TooltipButtonProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button aria-label={ariaLabel ?? tooltip} {...props} />
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
