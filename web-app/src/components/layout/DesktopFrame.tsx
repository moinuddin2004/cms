import { useEffect, useLayoutEffect, useState } from 'react'
import { Maximize2, Minimize2, Minus, X } from 'lucide-react'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { isDesktop } from '@/lib/desktop-session'
import { cn } from '@/lib/utils'

/**
 * Desktop (Tauri) shell chrome. The native window frame is switched off in
 * `tauri.conf.json` (`decorations: false`), so the app draws its own window
 * controls — coloured circular controls (minimise / maximise / close) in the
 * top-right corner — and looks like one native application instead of a web
 * page inside a window.
 *
 * No space is reserved: the circles float over the top-right corner and a thin
 * invisible strip along the top edge drags the window. Bars under them (Topbar)
 * add `.desktop-controls-inset`; a panel reaching that corner adds
 * `.desktop-below-controls` (see `styles.css`). In a browser this renders
 * nothing extra.
 */

async function currentWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

function TrafficLight({
  tooltip,
  color,
  onClick,
  children,
}: {
  tooltip: string
  color: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <TooltipButton
      variant="ghost"
      size="icon"
      tooltip={tooltip}
      tooltipSide="bottom"
      onClick={onClick}
      className={cn(
        'size-3.5 min-w-0 rounded-full p-0 text-black/60 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.2)] hover:text-black/70',
        color,
      )}
    >
      <span className="opacity-0 transition-opacity group-hover/lights:opacity-100">
        {children}
      </span>
    </TooltipButton>
  )
}

function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let off: (() => void) | undefined
    const state = { cancelled: false }
    void (async () => {
      const win = await currentWindow()
      const sync = async () => setMaximized(await win.isMaximized())
      await sync()
      const unlisten = await win.onResized(() => void sync())
      if (state.cancelled) unlisten()
      else off = unlisten
    })()
    return () => {
      state.cancelled = true
      off?.()
    }
  }, [])

  return (
    <div className="group/lights flex items-center gap-2">
      <TrafficLight
        tooltip="Minimize"
        color="bg-[var(--traffic-minimize)] hover:bg-[var(--traffic-minimize)]"
        onClick={async () => (await currentWindow()).minimize()}
      >
        <Minus className="size-2" strokeWidth={3.5} />
      </TrafficLight>
      <TrafficLight
        tooltip={maximized ? 'Restore' : 'Maximize'}
        color="bg-[var(--traffic-zoom)] hover:bg-[var(--traffic-zoom)]"
        onClick={async () => (await currentWindow()).toggleMaximize()}
      >
        {maximized ? (
          <Minimize2 className="size-2" strokeWidth={3.5} />
        ) : (
          <Maximize2 className="size-2" strokeWidth={3.5} />
        )}
      </TrafficLight>
      <TrafficLight
        tooltip="Close"
        color="bg-[var(--traffic-close)] hover:bg-[var(--traffic-close)]"
        onClick={async () => (await currentWindow()).close()}
      >
        <X className="size-2" strokeWidth={3.5} />
      </TrafficLight>
    </div>
  )
}

export function DesktopFrame({ children }: { children: React.ReactNode }) {
  const [desktop, setDesktop] = useState(false)

  // Client-only (the shell is prerendered): flip before first paint.
  useLayoutEffect(() => {
    if (!isDesktop()) return
    document.documentElement.dataset.desktop = 'true'
    setDesktop(true)
  }, [])

  return (
    <>
      {desktop ? (
        <>
          <div
            data-tauri-drag-region
            className="fixed inset-x-0 top-0 z-[99] h-2.5 select-none"
          />
          <div className="fixed right-4 top-[1.625rem] z-[100] select-none">
            <WindowControls />
          </div>
        </>
      ) : null}
      {children}
    </>
  )
}
