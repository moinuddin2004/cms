import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { API_BASE_URL } from '@/lib/api'
import { onDesktopLink } from '@/lib/desktop-links'
import { exchangeDesktopHandoff } from '../services/google.api'
import { apiErrorMessage, homeAfterLogin, storeSession } from '../lib/applyLogin'

/** How long the app waits for the browser to come back. */
const WAIT_TIMEOUT_MS = 3 * 60_000

/**
 * The app's half of the desktop Google sign-in: open the API's start URL in
 * the default browser, wait for `clinic://auth/callback?code=…&state=…`, then
 * redeem the one-time code. The Google token never enters the webview and the
 * session is stored by the same `storeSession()` every other login uses.
 */
export function useDesktopGoogleSignIn() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const stateRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const stopWaiting = useCallback(() => {
    stateRef.current = null
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    const off = onDesktopLink((url) => {
      const expected = stateRef.current
      const callback = parseCallback(url)
      // Ignore links from another attempt or not started by this window.
      if (!expected || !callback || callback.state !== expected) return

      stopWaiting()
      setError('')
      setBusy(true)
      void (async () => {
        try {
          const session = await exchangeDesktopHandoff(callback.code)
          storeSession(session)
          toast.success('Signed in with Google', {
            description: `Signed in as ${session.user.name || session.user.email}`,
          })
          navigate({ to: homeAfterLogin(session) })
        } catch (err) {
          setError(
            apiErrorMessage(err, 'Google sign-in failed. Please try again.'),
          )
          setBusy(false)
        }
      })()
    })
    return () => {
      off()
      stopWaiting()
    }
  }, [navigate, stopWaiting])

  const start = useCallback(async () => {
    setError('')
    setBusy(true)
    const state = crypto.randomUUID().replace(/-/g, '')
    stateRef.current = state
    timerRef.current = window.setTimeout(() => {
      stopWaiting()
      setBusy(false)
      setError('Google sign-in timed out. Please try again.')
    }, WAIT_TIMEOUT_MS)

    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(`${API_BASE_URL}/auth/google/desktop/start?state=${state}`)
    } catch {
      stopWaiting()
      setBusy(false)
      setError('Could not open your browser. Please try again.')
    }
  }, [stopWaiting])

  return { start, busy, error }
}

/** `clinic://auth/callback?code=…&state=…` → the two parameters. */
function parseCallback(raw: string): { code: string; state: string } | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'clinic:') return null
    if (url.host !== 'auth') return null
    if (url.pathname.replace(/^\/+|\/+$/g, '') !== 'callback') return null
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    return code && state ? { code, state } : null
  } catch {
    return null
  }
}
