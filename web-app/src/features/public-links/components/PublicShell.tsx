import type { ReactNode } from 'react'

/** Bare, phone-first frame for public landing pages: no auth, no dashboard shell. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center shadow-sm">
        {children}
      </div>
    </div>
  )
}
