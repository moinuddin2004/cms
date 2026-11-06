import { useEffect, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { AuthLayout } from '@/features/auth/components/AuthLayout'
import { labDirectoryApi } from '../services/labs.api'

type Status = 'confirming' | 'done' | 'failed'

/**
 * Landing page of the lab address confirmation email
 * (`/lab-email/confirm?token=…`). Public: labs often have no login.
 */
export function ConfirmLabEmailPage() {
  const search: { token?: unknown } = useSearch({ strict: false })
  const token = typeof search.token === 'string' ? search.token : ''
  const [status, setStatus] = useState<Status>(token ? 'confirming' : 'failed')
  const [message, setMessage] = useState(
    token ? '' : 'This link is missing its token.',
  )
  const [lab, setLab] = useState<{ labName: string; email: string } | null>(
    null,
  )
  const sent = useRef(false)

  useEffect(() => {
    if (!token || sent.current) return
    sent.current = true
    labDirectoryApi
      .confirmEmail(token)
      .then((r) => {
        setLab(r)
        setStatus('done')
      })
      .catch((err: { response?: { data?: { message?: unknown } } }) => {
        const msg = err.response?.data?.message
        setStatus('failed')
        setMessage(
          (Array.isArray(msg)
            ? String(msg[0])
            : typeof msg === 'string'
              ? msg
              : '') || 'This confirmation link is invalid or has expired.',
        )
      })
  }, [token])

  return (
    <AuthLayout>
      <div className="text-center">
        {status === 'confirming' && (
          <>
            <Loader2 className="mx-auto mb-4 size-10 animate-spin text-primary" />
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
              Confirming the email address…
            </h1>
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle2 className="mx-auto mb-4 size-10 text-emerald" />
            <h1 className="mb-2 text-[22px] font-semibold tracking-[-0.02em]">
              Email confirmed
            </h1>
            <p className="text-sm text-muted-foreground">
              Thanks — clinics can now email {lab?.labName} order links at{' '}
              <strong className="text-foreground">{lab?.email}</strong>. You can
              close this page.
            </p>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle className="mx-auto mb-4 size-10 text-destructive" />
            <h1 className="mb-2 text-[22px] font-semibold tracking-[-0.02em]">
              Link not valid
            </h1>
            <p className="text-sm text-muted-foreground">
              {message} Ask the platform team for a new link.
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  )
}
