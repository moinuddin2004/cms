import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { googleSignIn } from '../services/google.api'
import { useGoogleSignupStore } from '../store/useGoogleSignupStore'
import {
  apiErrorMessage,
  homeAfterLogin,
  storeSession,
} from '../lib/applyLogin'

/**
 * "Continue with Google" from the login or register page: signs in an
 * existing account. A Google account with no login is kept in the signup
 * store: the login page explains the options (register a clinic, or ask
 * the clinic for an invite link), the register page goes straight on.
 */
export function useGoogleSignIn({
  rememberMe = true,
}: { rememberMe?: boolean } = {}) {
  const navigate = useNavigate()
  const startSignup = useGoogleSignupStore((s) => s.start)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onCredential(credential: string) {
    setBusy(true)
    setError('')
    try {
      const result = await googleSignIn(credential, rememberMe)
      if (result.outcome === 'signed_in') {
        storeSession(result.session)
        toast.success('Welcome back!', {
          description: `Signed in as ${result.session.user.name || result.session.user.email}`,
        })
        navigate({ to: homeAfterLogin(result.session) })
      } else if (result.outcome === 'no_account') {
        startSignup(credential, result.profile, result.joinableClinics)
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Google sign-in failed. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return { onCredential, busy, error }
}
