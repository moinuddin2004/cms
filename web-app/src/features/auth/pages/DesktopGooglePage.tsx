import { useCallback, useEffect, useState } from 'react'
import { Loader2, MonitorSmartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '../components/AuthLayout'
import { AuthError, AuthHeading } from '../components/AuthPrimitives'
import { authSubmitClass } from '../components/authStyles'
import { GoogleButton } from '../google/GoogleButton'
import { createDesktopHandoff } from '../services/google.api'
import { apiErrorMessage } from '../lib/applyLogin'
import { DESKTOP_PROTOCOL } from '@/lib/desktop-links'

const STATE_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

/**
 * `/desktop-google?state=…` — the browser half of desktop Google sign-in.
 *
 * The desktop app opens this page in the system browser (Google refuses its
 * popup inside an embedded webview). The page verifies the Google account,
 * asks the API for a one-time code, and sends that code back to the app over
 * `clinic://auth/callback?code=…&state=…`. It never creates a session here.
 */
export function DesktopGooglePage({ state }: { state?: string }) {
  if (!state || !STATE_PATTERN.test(state)) {
    return (
      <AuthLayout>
        <MonitorSmartphone className="mb-5 size-12 rounded-2xl bg-panel-2 p-3 text-muted-foreground" />
        <AuthHeading
          title="Open sign-in from the app"
          subtitle="This page only works when the Clinic app opens it. Start Google sign-in from the app window."
        />
      </AuthLayout>
    )
  }
  return <DesktopHandoff state={state} />
}

function DesktopHandoff({ state }: { state: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<'no_account' | 'link_required' | null>(
    null,
  )

  // Send the app the one-time code. The click is already a user gesture from
  // the Google button, but some browsers still ask before leaving for a custom
  // protocol — the page also offers the link as a button.
  useEffect(() => {
    if (!deepLink) return
    const timer = window.setTimeout(() => {
      window.location.assign(deepLink)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [deepLink])

  const onCredential = useCallback(
    async (credential: string) => {
      setBusy(true)
      setError('')
      try {
        const result = await createDesktopHandoff(credential, state)
        if (result.outcome === 'signed_in') {
          setDeepLink(
            `${DESKTOP_PROTOCOL}://auth/callback?code=${encodeURIComponent(
              result.code,
            )}&state=${encodeURIComponent(state)}`,
          )
          return
        }
        if (result.outcome === 'no_account') {
          setBlocked('no_account')
        } else {
          setBlocked('link_required')
          setError(result.message)
        }
      } catch (err) {
        setError(
          apiErrorMessage(err, 'Google sign-in failed. Please try again.'),
        )
      } finally {
        setBusy(false)
      }
    },
    [state],
  )

  if (deepLink) {
    return (
      <AuthLayout>
        <MonitorSmartphone className="mb-5 size-12 rounded-2xl bg-primary/10 p-3 text-primary" />
        <AuthHeading
          title="Returning to the app"
          subtitle="Google is verified. The Clinic app is opening with your session."
        />
        <Button asChild className={authSubmitClass}>
          <a href={deepLink}>Open the Clinic app</a>
        </Button>
      </AuthLayout>
    )
  }

  if (blocked) {
    return (
      <AuthLayout>
        <MonitorSmartphone className="mb-5 size-12 rounded-2xl bg-panel-2 p-3 text-muted-foreground" />
        <AuthHeading
          title={
            blocked === 'no_account'
              ? 'No Clinic account for this Google user'
              : 'This Google account can’t sign in here'
          }
          subtitle={
            blocked === 'no_account'
              ? `Sign up on the web first (or ask your clinic for an invite), then set a password under Settings → Sign-in methods to use the desktop app.`
              : 'Use your email and password in the desktop app. Google sign-in from the desktop app only works for accounts that already sign in with Google.'
          }
        />
        {error ? <AuthError message={error} /> : null}
        <Button
          type="button"
          variant="outline"
          className={authSubmitClass}
          onClick={() => {
            setBlocked(null)
            setError('')
          }}
        >
          Try another Google account
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <MonitorSmartphone className="mb-5 size-12 rounded-2xl bg-primary/10 p-3 text-primary" />
      <AuthHeading
        title="Sign in with Google"
        subtitle="Finish here and the Clinic app will open signed in. You can close this tab afterwards."
      />
      {busy ? (
        <div className="flex h-10 items-center justify-center gap-2.5 rounded-xl border border-border bg-surface text-[14px] font-semibold text-foreground">
          <Loader2 className="size-[18px] animate-spin text-muted-foreground" />
          Finishing sign-in…
        </div>
      ) : (
        <GoogleButton text="signin_with" onCredential={onCredential} />
      )}
      {error ? (
        <div className="mt-4">
          <AuthError message={error} />
        </div>
      ) : null}
    </AuthLayout>
  )
}
