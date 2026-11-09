import { CalendarClock, Check, Inbox, MapPin, Users } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  StatusBadge,
} from '@/components/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatInClinic } from '@/lib/datetime'
import { useAccountSummary } from '../hooks/useAccount'
import { PAYMENT_METHOD_LABEL, STATUS_LABEL, STATUS_TONE } from '../types'
import type { AccountSummary, Plan } from '../types'

export const formatDay = (iso: string | null) =>
  formatInClinic(iso, 'd MMM yyyy')

export const planPrice = (plan: Plan) =>
  plan.monthlyPrice == null
    ? 'Custom pricing'
    : plan.monthlyPrice === 0
      ? 'Free'
      : `PKR ${plan.monthlyPrice.toLocaleString('en-PK')} / month`

const limitText = (n: number | null, word: string) =>
  n == null ? `Unlimited ${word}s` : `${n} ${word}${n === 1 ? '' : 's'}`

function UsageMeter({
  icon: Icon,
  label,
  used,
  max,
}: {
  icon: React.ElementType
  label: string
  used: number
  max: number | null
}) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4" />
          {label}
        </span>
        <span className="font-medium">
          {used} / {max ?? '∞'}
        </span>
      </div>
      {max != null && (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              pct >= 100 ? 'bg-red-500' : 'bg-primary',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function CurrentPlan({ account }: { account: AccountSummary }) {
  const { state } = account
  const periodLabel =
    state.status === 'trialing'
      ? 'Trial ends'
      : state.status === 'unmanaged'
        ? null
        : state.status === 'active'
          ? 'Paid until'
          : 'Ended on'
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg font-medium">
            {account.plan.name} plan
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {account.plan.description}
          </p>
        </div>
        <StatusBadge
          status={state.status}
          tone={STATUS_TONE[state.status]}
          label={STATUS_LABEL[state.status]}
        />
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2 text-sm">
          {periodLabel && (
            <p className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" />
              {periodLabel}{' '}
              <strong className="font-semibold">
                {formatDay(state.periodEndsAt)}
              </strong>
              {state.daysLeft != null && state.daysLeft >= 0 && (
                <span className="text-muted-foreground">
                  ({state.daysLeft} day{state.daysLeft === 1 ? '' : 's'} left)
                </span>
              )}
            </p>
          )}
          {state.readOnly && (
            <p className="text-red-600 dark:text-red-400">
              The clinic is read-only until a payment is recorded.
            </p>
          )}
          {state.status === 'unmanaged' && (
            <p className="text-muted-foreground">
              Your clinic has no subscription period set.
            </p>
          )}
        </div>
        <div className="space-y-3">
          <UsageMeter
            icon={MapPin}
            label="Locations"
            used={account.usage.locations}
            max={account.limits.maxLocations}
          />
          <UsageMeter
            icon={Users}
            label="Logins"
            used={account.usage.users}
            max={account.limits.maxUsers}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function PlansGrid({ account }: { account: AccountSummary }) {
  const plans = account.plans.filter((p) => p.key !== 'free')
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Plans</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const current = p.key === account.plan.key
          return (
            <div
              key={p.key}
              className={cn(
                'rounded-lg border bg-card p-5 shadow-sm',
                current
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-border',
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                {current && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-2 text-xl font-semibold">{planPrice(p)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {p.description}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  {limitText(p.maxLocations, 'location')}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  {limitText(p.maxUsers, 'login')}
                </li>
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function HowToPay({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">How to pay</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-line text-sm text-muted-foreground">
          {text}
        </p>
      </CardContent>
    </Card>
  )
}

function PaymentHistory({ account }: { account: AccountSummary }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Payment history</h2>
      {account.payments.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No payments yet"
          description="Payments appear here once they are confirmed."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Paid on</th>
                <th className="px-4 py-2.5 font-medium">Plan</th>
                <th className="px-4 py-2.5 font-medium">Period</th>
                <th className="px-4 py-2.5 font-medium">Method</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {account.payments.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                >
                  <td className="px-4 py-2.5">{formatDay(p.paidAt)}</td>
                  <td className="px-4 py-2.5 capitalize">
                    {p.plan} · {p.months} mo
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {formatDay(p.periodStart)} – {formatDay(p.periodEnd)}
                  </td>
                  <td className="px-4 py-2.5">
                    {PAYMENT_METHOD_LABEL[p.method]}
                    {p.reference && (
                      <span className="text-muted-foreground">
                        {' '}
                        · {p.reference}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    PKR {Number(p.amount).toLocaleString('en-PK')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** The clinic's plan, usage, how to pay and past payments (owners). */
export function SubscriptionPage() {
  const account = useAccountSummary()
  return (
    <DashboardLayout
      title="Plan & billing"
      subtitle="Your subscription, usage and payments."
      backTo="/settings"
      backLabel="Back to settings"
    >
      {account.isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : account.isError || !account.data ? (
        <ErrorState onRetry={() => void account.refetch()} />
      ) : !account.data.isOwner ? (
        <EmptyState
          title="Only the clinic owner can see this"
          description="Ask the owner about the clinic's plan."
        />
      ) : (
        <div className="space-y-6">
          <CurrentPlan account={account.data} />
          <HowToPay text={account.data.paymentInstructions} />
          <PlansGrid account={account.data} />
          <PaymentHistory account={account.data} />
        </div>
      )}
    </DashboardLayout>
  )
}
