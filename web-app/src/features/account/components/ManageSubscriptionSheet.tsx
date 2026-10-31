import { Inbox, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  EmptyState,
  ErrorState,
  FieldWrapper,
  LoadingSkeleton,
  StatusBadge,
} from '@/components/shared'
import { DatePicker } from '@/components/shared/DatePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/forms/NumberInput'
import { toInputValue } from '@/lib/zod-numbers'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAdminSubscription } from '../hooks/useAccount'
import {
  useRecordPaymentForm,
  useUpdateSubscriptionForm,
} from '../hooks/useAdminSubscriptionForms'
import { fieldError } from '../lib/fieldError'
import { formatDay, planPrice } from '../pages/SubscriptionPage'
import {
  PAYMENT_METHOD_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from '../types'
import type { AdminSubscription, PaymentMethod, PlanKey } from '../types'

function errorMessage(err: unknown) {
  const msg = (err as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message
  return Array.isArray(msg) ? String(msg[0]) : (msg as string) || 'Could not save. Try again.'
}

/** Monthly price × months typed, rounded to paisa ('' while months is empty). */
const amountFor = (monthlyPrice: number, months: string) =>
  months.trim() === ''
    ? ''
    : toInputValue(Math.round(monthlyPrice * Number(months) * 100) / 100)

function RecordPaymentForm({
  orgId,
  sub,
}: {
  orgId: string
  sub: AdminSubscription
}) {
  const { form, record } = useRecordPaymentForm(orgId, sub, () =>
    toast.success('Payment recorded — the plan is extended'),
  )
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit().catch((err) => toast.error(errorMessage(err)))
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="plan">
          {(f) => (
            <FieldWrapper label="Plan" required error={fieldError(f)}>
              <Select
                value={f.state.value}
                onValueChange={(v) => {
                  f.handleChange(v as PlanKey)
                  const price = sub.plans.find((p) => p.key === v)?.monthlyPrice
                  if (price != null) {
                    form.setFieldValue(
                      'amount',
                      amountFor(price, form.getFieldValue('months')),
                    )
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sub.plans.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.name} — {planPrice(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="months">
          {(f) => (
            <FieldWrapper label="Months paid" htmlFor="pay-months" required error={fieldError(f)}>
              <NumberInput
                id="pay-months"
                mode="integer"
                value={f.state.value}
                onChange={(e) => {
                  const months = e.target.value
                  f.handleChange(months)
                  const price = sub.plans.find(
                    (p) => p.key === form.getFieldValue('plan'),
                  )?.monthlyPrice
                  if (price != null) {
                    form.setFieldValue('amount', amountFor(price, months))
                  }
                }}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="amount">
          {(f) => (
            <FieldWrapper label="Amount received (PKR)" htmlFor="pay-amount" required error={fieldError(f)}>
              <NumberInput
                id="pay-amount"
                mode="decimal"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="method">
          {(f) => (
            <FieldWrapper label="Method" required error={fieldError(f)}>
              <Select
                value={f.state.value}
                onValueChange={(v) => f.handleChange(v as PaymentMethod)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABEL).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="paidAt">
          {(f) => (
            <FieldWrapper label="Paid on" required error={fieldError(f)}>
              <DatePicker value={f.state.value} onChange={f.handleChange} />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="reference">
          {(f) => (
            <FieldWrapper label="Reference / transaction ID" htmlFor="pay-ref" error={fieldError(f)}>
              <Input
                id="pay-ref"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </div>
      <form.Field name="notes">
        {(f) => (
          <FieldWrapper label="Notes" htmlFor="pay-notes" error={fieldError(f)}>
            <Textarea
              id="pay-notes"
              rows={2}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
            />
          </FieldWrapper>
        )}
      </form.Field>
      <p className="text-xs text-muted-foreground">
        The new period starts when the current trial or paid period ends (or
        today, if it already has).
      </p>
      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit || isSubmitting || record.isPending}>
              {(isSubmitting || record.isPending) && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Record payment
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}

function PlanForm({ orgId, sub }: { orgId: string; sub: AdminSubscription }) {
  const { form, update } = useUpdateSubscriptionForm(orgId, sub, () =>
    toast.success('Subscription updated'),
  )
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit().catch((err) => toast.error(errorMessage(err)))
      }}
    >
      <form.Field name="plan">
        {(f) => (
          <FieldWrapper label="Plan" required error={fieldError(f)}>
            <Select
              value={f.state.value}
              onValueChange={(v) => f.handleChange(v as PlanKey)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sub.plans.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldWrapper>
        )}
      </form.Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="trialEndsAt">
          {(f) => (
            <FieldWrapper
              label="Trial ends"
              hint="Extend a trial by moving this date."
              error={fieldError(f)}
            >
              <DatePicker
                value={f.state.value ?? undefined}
                onChange={(v) => f.handleChange(v || null)}
                clearable
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="paidUntil">
          {(f) => (
            <FieldWrapper
              label="Paid until"
              hint="Normally set by recording a payment."
              error={fieldError(f)}
            >
              <DatePicker
                value={f.state.value ?? undefined}
                onChange={(v) => f.handleChange(v || null)}
                clearable
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="maxLocations">
          {(f) => (
            <FieldWrapper
              label="Location limit"
              htmlFor="lim-loc"
              hint={`Empty = plan default (${sub.plan.maxLocations ?? 'unlimited'}).`}
              error={fieldError(f)}
            >
              <NumberInput
                id="lim-loc"
                mode="integer"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="maxUsers">
          {(f) => (
            <FieldWrapper
              label="Login limit"
              htmlFor="lim-users"
              hint={`Empty = plan default (${sub.plan.maxUsers ?? 'unlimited'}).`}
              error={fieldError(f)}
            >
              <NumberInput
                id="lim-users"
                mode="integer"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Clearing both dates makes the clinic unmanaged: no expiry and no plan
        limits.
      </p>
      <form.Subscribe
        selector={(s) => [s.canSubmit, s.isSubmitting, s.isDirty] as const}
      >
        {([canSubmit, isSubmitting, isDirty]) => (
          <div className="flex items-center justify-end gap-3">
            {isDirty && (
              <span className="text-xs text-amber-600">Unsaved changes</span>
            )}
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting || update.isPending || !isDirty}
            >
              {(isSubmitting || update.isPending) && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Save
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}

function History({ sub }: { sub: AdminSubscription }) {
  if (!sub.payments.length) {
    return <EmptyState icon={Inbox} title="No payments recorded yet" />
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {sub.payments.map((p) => (
        <li key={p.id} className="flex items-start justify-between gap-4 p-3 text-sm">
          <div>
            <p className="font-medium capitalize">
              {p.plan} · {p.months} month{p.months === 1 ? '' : 's'}
            </p>
            <p className="text-muted-foreground">
              {formatDay(p.periodStart)} – {formatDay(p.periodEnd)} ·{' '}
              {PAYMENT_METHOD_LABEL[p.method]}
              {p.reference ? ` · ${p.reference}` : ''}
            </p>
            {p.notes && <p className="mt-1 text-muted-foreground">{p.notes}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold">
              PKR {Number(p.amount).toLocaleString('en-PK')}
            </p>
            <p className="text-xs text-muted-foreground">{formatDay(p.paidAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Super admin: one clinic's subscription — record payments, change plan. */
export function ManageSubscriptionSheet({
  orgId,
  onOpenChange,
}: {
  orgId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const sub = useAdminSubscription(orgId)
  const data = sub.data
  return (
    <Sheet open={!!orgId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="flex items-center gap-3">
            {data?.organization.name ?? 'Subscription'}
            {data && (
              <StatusBadge
                status={data.state.status}
                tone={STATUS_TONE[data.state.status]}
                label={STATUS_LABEL[data.state.status]}
              />
            )}
          </SheetTitle>
          <SheetDescription>
            {data
              ? `${data.plan.name} plan · ${data.usage.locations} location(s), ${data.usage.users} login(s)` +
                (data.state.periodEndsAt
                  ? ` · ends ${formatDay(data.state.periodEndsAt)}`
                  : '')
              : 'Loading…'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 py-5">
          {sub.isLoading ? (
            <LoadingSkeleton variant="detail" />
          ) : sub.isError || !data || !orgId ? (
            <ErrorState onRetry={() => void sub.refetch()} />
          ) : (
            <Tabs defaultValue="payment">
              <TabsList>
                <TabsTrigger value="payment">Record payment</TabsTrigger>
                <TabsTrigger value="plan">Plan & limits</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              <TabsContent value="payment" className="mt-4">
                <RecordPaymentForm orgId={orgId} sub={data} />
              </TabsContent>
              <TabsContent value="plan" className="mt-4">
                <PlanForm orgId={orgId} sub={data} />
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                <History sub={data} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
