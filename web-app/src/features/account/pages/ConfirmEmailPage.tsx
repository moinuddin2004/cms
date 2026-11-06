import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, LogOut, MailCheck, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import apiClient from '@/lib/api'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { AuthHeading } from '@/features/auth/components/AuthPrimitives'
import { useAuthStore } from '@/store/useAuthStore'
import { useResendVerification } from '../hooks/useAccount'

/**
 * Shown when the API refuses the account with EMAIL_NOT_VERIFIED: an
 * unverified password account past its grace date. Everything else stays
 * closed until the link in the email is clicked (or a super admin marks the
 * address verified).
 */
export function ConfirmEmailPage() {
  const navigate = useNavigate()
  const email = useAuthStore((s) => s.user?.email ?? '')
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const setRequired = useAuthStore((s) => s.setEmailVerificationRequired)
  const resend = useResendVerification()
  const [checking, setChecking] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  /**
   * Try again with a light, context-free request (it still passes the
   * verification guard): EMAIL_NOT_VERIFIED again means not verified yet.
   */
  async function continueOn() {
    setChecking(true)
    try {
      await apiClient.get('/me/notifications/unread-count')
      setRequired(false)
      useAuthStore.setState((s) =>
        s.user
          ? {
              user: {
                ...s.user,
                emailVerificationPending: false,
                emailVerificationDueAt: null,
              },
            }
          : {},
      )
      void navigate({ to: '/', replace: true })
    } catch {
      toast.error('Your email is not verified yet. Open the link we sent you.')
    } finally {
      setChecking(false)
    }
  }

  async function signOut() {
    setSigningOut(true)
    try {
      await apiClient.post('/auth/logout')
    } finally {
      clearAuth()
      setSigningOut(false)
      void navigate({ to: '/login', replace: true })
    }
  }

  return (
    <AuthLayout>
      <div className="text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MailCheck className="size-6" />
        </span>
        <AuthHeading
          title="Verify your email to continue"
          subtitle={
            <>
              We sent a verification link to{' '}
              <strong className="font-semibold text-foreground">{email}</strong>
              . Open it, then come back here.
            </>
          }
        />
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => void continueOn()} disabled={checking}>
            {checking ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-4" />
            )}
            I’ve verified — continue
          </Button>
          <Button
            variant="outline"
            disabled={resend.isPending}
            onClick={() =>
              resend.mutate(undefined, {
                onSuccess: (r) => toast.success(r.message),
                onError: () =>
                  toast.error('Could not send the email. Try again.'),
              })
            }
          >
            {resend.isPending && (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            )}
            Send a new link
          </Button>
          <Button
            variant="ghost"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            {signingOut ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <LogOut className="mr-1.5 size-4" />
            )}
            Sign out
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Wrong email address, or no email arriving? Ask your clinic owner to
          correct it, or contact support.
        </p>
      </div>
    </AuthLayout>
  )
}
