import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { TooltipButton } from '@/components/shared/TooltipButton'

interface BackButtonProps {
  /** Route to go back to, e.g. `/patients`. */
  to: string
  /** Tooltip text, e.g. "Back to patients". */
  label?: string
}

/**
 * Small ← button shown left of the title on nested/detail pages.
 * Use this instead of breadcrumbs (same look as the patient detail header).
 */
export function BackButton({ to, label = 'Back' }: BackButtonProps) {
  return (
    <TooltipButton
      tooltip={label}
      tooltipSide="bottom"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      asChild
    >
      <Link to={to}>
        <ArrowLeft size={14} />
      </Link>
    </TooltipButton>
  )
}
