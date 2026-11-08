import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isDesktop } from '@/lib/desktop-session'
import { fetchGoogleConfig } from '../services/google.api'
import { useDesktopGoogleSignIn } from './useDesktopGoogleSignIn'

const GSI_SRC = 'https://accounts.google.com/gsi/client'

interface GsiButtonOptions {
  type: 'standard'
  theme: 'outline' | 'filled_black'
  size: 'large'
  text: 'signin_with' | 'signup_with' | 'continue_with'
  shape: 'rectangular' | 'pill'
  logo_alignment: 'left' | 'center'
  width?: number
}

interface GoogleIdApi {
  initialize: (o: {
    client_id: string
    callback: (r: { credential: string }) => void
    ux_mode?: 'popup'
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (el: HTMLElement, o: GsiButtonOptions) => void
  cancel: () => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
  }
}

let scriptPromise: Promise<void> | null = null

/** Load Google Identity Services once per page. */
function loadGsi(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('Could not load Google sign-in'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Whether Google sign-in is offered at all. The login screen handles both
 * worlds (page popup on the web, system browser + `clinic://` on desktop);
 * screens that only support the web popup — sign-up, account linking, clinic
 * invites — add `&& !isDesktop()` themselves.
 */
export function googleSignInAvailable(
  configured: boolean | undefined,
): boolean {
  return Boolean(configured)
}

/** Whether Google sign-in is set up on the server (public config). */
export function useGoogleConfig() {
  return useQuery({
    queryKey: ['auth', 'google-config'],
    queryFn: fetchGoogleConfig,
    staleTime: 10 * 60_000,
    retry: false,
  })
}

const LABEL: Record<GsiButtonOptions['text'], string> = {
  signin_with: 'Sign in with Google',
  signup_with: 'Sign up with Google',
  continue_with: 'Continue with Google',
}

/**
 * "Continue with Google", drawn in the app's own style. Google's real
 * Identity Services button sits invisibly on top of it and takes the click,
 * so the popup and the ID token still come from Google. Calls
 * `onCredential` with the ID token; the server verifies it. Renders nothing
 * when Google sign-in isn't configured on the server.
 */
export function GoogleButton({
  onCredential,
  text = 'continue_with',
  busy = false,
}: {
  onCredential: (credential: string) => void
  text?: GsiButtonOptions['text']
  busy?: boolean
}) {
  const { data: config } = useGoogleConfig()
  const ref = useRef<HTMLDivElement>(null)
  const callback = useRef(onCredential)
  callback.current = onCredential
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const desktop = isDesktop()
  // Desktop can't run Google's popup inside its webview: the click opens the
  // system browser, and the session comes back over `clinic://`.
  const desktopGoogle = useDesktopGoogleSignIn()

  const clientId = config?.enabled ? config.clientId : null

  useEffect(() => {
    if (desktop || !clientId || !ref.current) return
    let cancelled = false
    loadGsi()
      .then(() => {
        const el = ref.current
        const id = window.google?.accounts.id
        if (cancelled || !el || !id) return
        id.initialize({
          client_id: clientId,
          callback: (r) => callback.current(r.credential),
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        el.innerHTML = ''
        id.renderButton(el, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, el.clientWidth || 360)),
        })
        setReady(true)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [clientId, text, desktop])

  if (!clientId) return null

  if (desktop) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => void desktopGoogle.start()}
          disabled={desktopGoogle.busy}
          aria-busy={desktopGoogle.busy}
          className={cn(
            'group relative flex h-10 w-full cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-xl border border-border bg-surface text-[14px] font-semibold text-foreground transition-colors',
            'hover:border-primary/40 hover:bg-accent focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none',
            desktopGoogle.busy && 'pointer-events-none',
          )}
        >
          {desktopGoogle.busy ? (
            <Loader2 className="size-[18px] animate-spin text-muted-foreground" />
          ) : (
            <GoogleMark className="size-[18px]" />
          )}
          {desktopGoogle.busy ? 'Finish in your browser…' : LABEL[text]}
        </button>
        {desktopGoogle.error ? (
          <p role="alert" className="text-center text-xs text-destructive">
            {desktopGoogle.error}
          </p>
        ) : null}
      </div>
    )
  }

  if (failed) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Google sign-in could not load. Check your connection and reload.
      </p>
    )
  }
  return (
    <div
      className={cn(
        'group relative h-10 w-full overflow-hidden rounded-xl border border-border bg-surface transition-colors',
        'hover:border-primary/40 hover:bg-accent focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25',
        (busy || !ready) && 'pointer-events-none',
      )}
      aria-busy={busy}
    >
      {/* What people see */}
      <div
        aria-hidden="true"
        className="flex h-full items-center justify-center gap-2.5 text-[14px] font-semibold text-foreground"
      >
        {busy ? (
          <Loader2 className="size-[18px] animate-spin text-muted-foreground" />
        ) : (
          <GoogleMark className="size-[18px]" />
        )}
        {busy ? 'Signing in…' : LABEL[text]}
      </div>
      {/* Google's button, invisible, takes the click (and keyboard focus) */}
      <div
        ref={ref}
        className="absolute inset-0 flex items-center justify-center opacity-[0.01] [&_iframe]:!w-full"
      />
    </div>
  )
}

/** The Google "G" (brand colours are part of the mark). */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}

/** "or" divider between the Google button and the email form. */
export function AuthDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="my-4 flex items-center gap-3 text-[12px] text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
