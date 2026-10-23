import { useEffect } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { AlertTriangle, Clock, Loader2, Lock, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import { useAccountSummary, useResendVerification } from '../hooks/useAccount'
import type { AccountSummary } from '../types'

/** Days before the trial / paid period ends when the banner starts showing. */
const WARN_DAYS = 7

const TONE = {
  info: 'border-primary/20 bg-primary/5 text-foreground',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200',
  danger:
    'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200',
}

function Bar({
  tone,
  icon: Icon,
  children,
  action,
}: {
  tone: keyof typeof TONE
  icon: React.ElementType
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      role="status"
      className={cn(
        'mb-3 flex flex-col gap-2 rounded-lg border px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between',
        TONE[tone],
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <span>{children}</span>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function SubscriptionBar({ account }: { account: AccountSummary }) {
  const { state, isOwner } = account
  const days = state.daysLeft ?? 0
  const plansLink = isOwner ? (
    <Button asChild size="sm" variant="outline" className="h-8 bg-background">
      <Link to="/settings/subscription">See plans</Link>
    </Button>
  ) : null

  if (state.status === 'expired') {
    return (
      <Bar tone="danger" icon={Lock} action={plansLink}>
        <strong className="font-semibold">Subscription expired.</strong>{' '}
        {isOwner
          ? 'The clinic is read-only — renew your plan to make changes again.'
          : 'The clinic is read-only until the owner renews the plan.'}
      </Bar>
    )
  }
  if (state.status === 'grace') {
    const left = state.readOnlyFrom
      ? Math.max(
          0,
          Math.ceil(
            (new Date(state.readOnlyFrom).getTime() - Date.now()) / 86_400_000,
          ),
        )
      : 0
    return (
      <Bar tone="warning" icon={AlertTriangle} action={plansLink}>
        <strong className="font-semibold">Your plan has ended.</strong> The
        clinic turns read-only in {plural(left, 'day')} unless it is renewed.
      </Bar>
    )
  }
  if (state.status === 'trialing' && isOwner) {
    return (
      <Bar tone="info" icon={Clock} action={plansLink}>
        Free trial — {plural(Math.max(days, 0), 'day')} left.
      </Bar>
    )
  }
  if (state.status === 'active' && isOwner && days <= WARN_DAYS) {
    return (
      <Bar tone="warning" icon={Clock} action={plansLink}>
        Your plan renews in {plural(Math.max(days, 0), 'day')} — send the
        payment to keep the clinic running without interruption.
      </Bar>
    )
  }
  return null
}

function VerifyEmailBar({ email }: { email: string }) {
  const resend = useResendVerification()
  return (
    <Bar
      tone="info"
      icon={MailCheck}
      action={
        <Button
          size="sm"
          variant="outline"
          className="h-8 bg-background"
          disabled={resend.isPending}
          onClick={() =>
            resend.mutate(undefined, {
              onSuccess: (r) => toast.success(r.message),
              onError: () => toast.error('Could not send the email. Try again.'),
            })
          }
        >
          {resend.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
          Resend link
        </Button>
      }
    >
      Please verify your email — we sent a link to{' '}
      <strong className="font-semibold">{email}</strong>.
    </Bar>
  )
}

/**
 * Top-of-page notices for the active clinic: unverified email, trial /
 * renewal / expiry. Also sends an owner whose clinic hasn't finished setup
 * to the setup wizard.
 */
export function AccountBanner() {
  const user = useAuthStore((s) => s.user)
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin)
  const account = useAccountSummary(!isSuperAdmin)
  const navigate = useNavigate()
  const path = useRouterState({ select: (s) => s.location.pathname })

  const needsSetup =
    !!account.data?.onboardingPending && account.data.isOwner && !isSuperAdmin
  useEffect(() => {
    if (needsSetup && path !== '/setup') {
      void navigate({ to: '/setup', replace: true })
    }
  }, [needsSetup, path, navigate])

  return (
    <>
      {user?.emailVerificationPending && <VerifyEmailBar email={user.email} />}
      {account.data && <SubscriptionBar account={account.data} />}
    </>
  )
}
