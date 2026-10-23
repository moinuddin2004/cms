import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { MouseEvent } from 'react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { useBackNavigation } from '@/hooks/useBackNavigation'

interface BackButtonProps {
  /** Fallback route when there is no in-app page to return to, e.g. `/patients`. */
  to: string
  /** Fallback tooltip text, e.g. "Back to patients". */
  label?: string
  /** `lg` for full-screen workspaces with a taller header. */
  size?: 'sm' | 'lg'
}

/**
 * Small ← button shown left of the title on nested/detail pages.
 * Use this instead of breadcrumbs (same look as the patient detail header).
 * Returns to the page the user came from; `to` is used only when the page
 * was opened directly. Ctrl/middle-click still opens `to` in a new tab.
 */
export function BackButton({ to, label, size = 'sm' }: BackButtonProps) {
  const back = useBackNavigation(to, label)

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return
    e.preventDefault()
    back.goBack()
  }

  return (
    <TooltipButton
      tooltip={back.label}
      tooltipSide="bottom"
      variant="ghost"
      size="icon"
      className={
        size === 'lg'
          ? 'size-9 shrink-0'
          : 'h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground'
      }
      asChild
    >
      <Link to={to} onClick={onClick}>
        <ArrowLeft className={size === 'lg' ? 'size-5' : 'size-3.5'} />
      </Link>
    </TooltipButton>
  )
}
