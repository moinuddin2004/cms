import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { useAuthStore } from '@/store/useAuthStore'
import { verifyEmail } from '../services/account.api'

type Status = 'verifying' | 'done' | 'failed'

/** Landing page of the verification email link (`/verify-email?token=…`). */
export function VerifyEmailPage() {
  const search = useSearch({ strict: false }) as { token?: string }
  const token = search.token ?? ''
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'failed')
  const [message, setMessage] = useState(
    token ? '' : 'This link is missing its token.',
  )
  const sent = useRef(false)

  useEffect(() => {
    if (!token || sent.current) return
    sent.current = true
    verifyEmail(token)
      .then(() => {
        setStatus('done')
        // Hide the "verify your email" banner for the signed-in user.
        useAuthStore.setState((s) => ({
          emailVerificationRequired: false,
          ...(s.user
            ? {
                user: {
                  ...s.user,
                  emailVerificationPending: false,
                  emailVerificationDueAt: null,
                },
              }
            : {}),
        }))
      })
      .catch((err) => {
        const msg = err?.response?.data?.message
        setStatus('failed')
        setMessage(
          (Array.isArray(msg) ? msg[0] : msg) ||
            'This verification link is invalid or has expired.',
        )
      })
  }, [token])

  const goOn = () =>
    navigate({ to: isAuthenticated ? '/' : '/login', replace: true })

  return (
    <AuthLayout>
      <div className="text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="mx-auto mb-4 size-10 animate-spin text-primary" />
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
              Verifying your email…
            </h1>
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle2 className="mx-auto mb-4 size-10 text-emerald" />
            <h1 className="mb-2 text-[22px] font-semibold tracking-[-0.02em]">
              Email verified
            </h1>
            <p className="mb-8 text-sm text-muted-foreground">
              Thanks — your email address is confirmed.
            </p>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle className="mx-auto mb-4 size-10 text-destructive" />
            <h1 className="mb-2 text-[22px] font-semibold tracking-[-0.02em]">
              Link not valid
            </h1>
            <p className="mb-8 text-sm text-muted-foreground">
              {message}{' '}
              {isAuthenticated &&
                'Use "Resend link" in the app to get a new one.'}
            </p>
          </>
        )}
        {status !== 'verifying' && (
          <Button
            onClick={goOn}
            className="h-11 w-full rounded-xl font-semibold"
          >
            {isAuthenticated ? 'Continue to the app' : 'Go to sign in'}
          </Button>
        )}
      </div>
    </AuthLayout>
  )
}
