import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { MouseEvent } from 'react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Button } from '@/components/ui/button'
import { useBackNavigation } from '@/hooks/useBackNavigation'
import { cn } from '@/lib/utils'

interface BackButtonProps {
  /**
   * Fallback route when there is no in-app page to return to, e.g. `/patients`.
   * Omit on top-level pages: the button then shows only when the user came
   * from inside another page (not the sidebar, not a direct link).
   */
  to?: string
  /** Fallback tooltip text, e.g. "Back to patients". */
  label?: string
  /** `lg` for full-screen workspaces with a taller header. */
  size?: 'sm' | 'lg'
  /** `link` = "← Back to …" text, for pages whose header the layout doesn't draw. */
  variant?: 'icon' | 'link'
  className?: string
}

/**
 * Small ← button shown left of the title on nested/detail pages.
 * Use this instead of breadcrumbs (same look as the patient detail header).
 * Returns to the page the user came from; `to` is used only when the page
 * was opened directly. Ctrl/middle-click opens that page in a new tab.
 */
export function BackButton({
  to,
  label,
  size = 'sm',
  variant = 'icon',
  className,
}: BackButtonProps) {
  const back = useBackNavigation(to, label)
  if (!back) return null

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return
    e.preventDefault()
    back.goBack()
  }

  if (variant === 'link') {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          '-ml-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground',
          className,
        )}
        asChild
      >
        <Link to={back.href} onClick={onClick}>
          <ArrowLeft className="size-3.5" />
          {back.label}
        </Link>
      </Button>
    )
  }

  return (
    <TooltipButton
      tooltip={back.label}
      tooltipSide="bottom"
      variant="ghost"
      size="icon"
      className={cn(
        size === 'lg'
          ? 'size-9 shrink-0'
          : 'h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
      data-page-back=""
      asChild
    >
      <Link to={back.href} onClick={onClick}>
        <ArrowLeft className={size === 'lg' ? 'size-5' : 'size-3.5'} />
      </Link>
    </TooltipButton>
  )
}
