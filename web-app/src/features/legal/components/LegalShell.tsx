import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

/** Plain public page frame: no sign-in, no sidebar. */
export function LegalShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <main className="mx-auto max-w-3xl p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {children}
        </div>
        <nav
          aria-label="Legal pages"
          className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500"
        >
          <Link to="/privacy" className="hover:text-primary">
            Privacy policy
          </Link>
          <Link to="/terms" className="hover:text-primary">
            Terms of use
          </Link>
          <Link to="/delete-account" className="hover:text-primary">
            Delete account
          </Link>
        </nav>
      </main>
    </div>
  )
}
