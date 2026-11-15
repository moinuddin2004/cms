import { useEffect } from 'react'
import type { ReactNode } from 'react'

/** Bare, phone-first frame for public landing pages: no auth, no dashboard shell. */
export function PublicShell({ children }: { children: ReactNode }) {
  // The URL carries a bearer token — never leak it through the Referer header.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'no-referrer'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        {children}
      </div>
    </div>
  )
}
