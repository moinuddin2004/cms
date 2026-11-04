import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowRight,
  Building2,
  Clock,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldX,
  UserPlus,
} from 'lucide-react'
import apiClient from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fieldError } from '@/components/forms/fieldError'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { formatDate } from '@/lib/datetime'
import { activeClinicBlock, useAuthStore } from '@/store/useAuthStore'
import { AuthLayout } from '../components/AuthLayout'
import { AuthError, AuthHeading } from '../components/AuthPrimitives'
import {
  authAltClass,
  authInputClass,
  authLabelClass,
  authSubmitClass,
} from '../components/authStyles'
import { fetchMyJoinRequests } from '../services/google.api'
import type { MyJoinRequest } from '../services/google.api'
import { useCreateClinicForm } from '../hooks/useCreateClinicForm'
import { storeSession } from '../lib/applyLogin'
import type { LoginPayload } from '../lib/applyLogin'

const fieldErrorClass = 'mt-1.5 text-xs font-medium text-destructive'

/**
 * Signed in, but there is no clinic to open: the active one awaits super
 * admin approval, was rejected, or doesn't accept this sign-in method — or
 * the user isn't in any clinic yet (Google sign-up with a join request).
 */
export function ClinicAccessPage() {
  const orgs = useAuthStore((s) => s.accessibleOrganizations)
  const activeOrganizationId = useAuthStore((s) => s.activeOrganizationId)
  const block = activeClinicBlock({
    accessibleOrganizations: orgs,
    activeOrganizationId,
  })
  const activeOrg = orgs.find((o) => o.id === activeOrganizationId)

  return (
    <AuthLayout>
      {orgs.length === 0 || !block ? (
        <NoClinic />
      ) : (
        <BlockedClinic
          code={block.code}
          message={block.message}
          clinicName={activeOrg?.name ?? 'Your clinic'}
          canSwitch={orgs.length > 1}
        />
      )}
    </AuthLayout>
  )
}

function useSignOut() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [busy, setBusy] = useState(false)
  async function signOut() {
    setBusy(true)
    try {
      await apiClient.post('/auth/logout')
    } finally {
      clearAuth()
      setBusy(false)
      void navigate({ to: '/login' })
    }
  }
  return { signOut, busy }
}

/** Re-read the session: picks up an approval or a policy change. */
function useRecheck() {
  const [busy, setBusy] = useState(false)
  async function recheck() {
    setBusy(true)
    try {
      const { data } = await apiClient.get('/auth/me')
      const me = data?.data as LoginPayload | undefined
      if (me) {
        const s = useAuthStore.getState()
        storeSession({
          ...me,
          activeOrganizationId:
            s.activeOrganizationId ?? me.activeOrganizationId,
          activeLocationId: s.activeLocationId ?? me.activeLocationId,
        })
        const still = activeClinicBlock(useAuthStore.getState())
        if (still) toast.info('Nothing has changed yet.')
      }
    } catch {
      toast.error('Could not check right now. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }
  return { recheck, busy }
}

function BlockedClinic({
  code,
  message,
  clinicName,
  canSwitch,
}: {
  code: string
  message: string
  clinicName: string
  canSwitch: boolean
}) {
  const navigate = useNavigate()
  const requestClinicSelection = useAuthStore((s) => s.requestClinicSelection)
  const { signOut, busy: signingOut } = useSignOut()
  const { recheck, busy: checking } = useRecheck()

  const pending = code === 'CLINIC_PENDING_APPROVAL'
  const rejected = code === 'CLINIC_REJECTED'
  const Icon = pending ? Clock : rejected ? ShieldX : KeyRound
  const title = pending
    ? 'Awaiting approval'
    : rejected
      ? 'Registration not approved'
      : 'Sign in another way'

  return (
    <>
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <AuthHeading
        title={title}
        subtitle={
          <>
            <span className="font-medium text-foreground">{clinicName}</span>
            {' — '}
            {message}
          </>
        }
      />

      <div className="space-y-3">
        {pending && (
          <Button
            type="button"
            className={authSubmitClass}
            onClick={recheck}
            disabled={checking}
          >
            {checking ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            {checking ? 'Checking…' : 'Check again'}
          </Button>
        )}
        {canSwitch && (
          <Button
            type="button"
            variant="outline"
            className={authSubmitClass}
            onClick={() => {
              requestClinicSelection()
              void navigate({ to: '/select-location' })
            }}
          >
            <Building2 className="mr-2 size-4" />
            Open another clinic
          </Button>
        )}
        <Button
          type="button"
          variant={pending || canSwitch ? 'ghost' : 'default'}
          className={authSubmitClass}
          onClick={signOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 size-4" />
          )}
          Sign out
        </Button>
      </div>
    </>
  )
}

const STATUS_LABEL: Record<MyJoinRequest['status'], string> = {
  pending: 'Waiting for the clinic',
  approved: 'Accepted',
  rejected: 'Declined',
}

function NoClinic() {
  const { signOut, busy: signingOut } = useSignOut()
  const { recheck, busy: checking } = useRecheck()
  const [creating, setCreating] = useState(false)
  const requests = useQuery({
    queryKey: ['join-requests', 'mine'],
    queryFn: fetchMyJoinRequests,
  })
  const hasPending = requests.data?.some((r) => r.status === 'pending')

  return (
    <>
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <UserPlus className="size-6" />
      </div>
      <AuthHeading
        title="You're not in a clinic yet"
        subtitle={
          hasPending
            ? 'Your request has been sent. You will get access as soon as the clinic accepts it.'
            : 'Ask your clinic to add you with this email, or set up your own clinic.'
        }
      />

      {requests.isLoading ? (
        <LoadingSkeleton variant="table" />
      ) : requests.isError ? (
        <ErrorState
          title="Couldn't load your requests"
          onRetry={() => void requests.refetch()}
        />
      ) : requests.data && requests.data.length > 0 ? (
        <ul className="mb-5 space-y-2">
          {requests.data.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-foreground">
                  {r.organizationName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sent {formatDate(r.createdAt)}
                  {r.decisionNote ? ` · ${r.decisionNote}` : ''}
                </p>
              </div>
              <Badge
                variant={
                  r.status === 'rejected'
                    ? 'danger'
                    : r.status === 'approved'
                      ? 'success'
                      : 'warning'
                }
              >
                {STATUS_LABEL[r.status]}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {creating ? (
        <CreateClinicForm onCancel={() => setCreating(false)} />
      ) : (
        <div className="space-y-3">
          {hasPending && (
            <Button
              type="button"
              className={authSubmitClass}
              onClick={recheck}
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              {checking ? 'Checking…' : 'Check again'}
            </Button>
          )}
          <Button
            type="button"
            variant={hasPending ? 'outline' : 'default'}
            className={authSubmitClass}
            onClick={() => setCreating(true)}
          >
            <Building2 className="mr-2 size-4" />
            Set up my own clinic
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={authSubmitClass}
            onClick={signOut}
            disabled={signingOut}
          >
            {signingOut ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 size-4" />
            )}
            Sign out
          </Button>
        </div>
      )}
    </>
  )
}

function CreateClinicForm({ onCancel }: { onCancel: () => void }) {
  const { form, globalError } = useCreateClinicForm()
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="space-y-4">
        <form.Field name="clinicName">
          {(field) => (
            <div>
              <Label htmlFor="c-clinic" className={authLabelClass}>
                Clinic name
              </Label>
              <Input
                id="c-clinic"
                placeholder="City Care Clinic"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={!!fieldError(field)}
                className={authInputClass}
              />
              {fieldError(field) && (
                <p className={fieldErrorClass}>{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <div>
              <Label htmlFor="c-phone" className={authLabelClass}>
                Phone{' '}
                <span className="font-normal text-text-3">(optional)</span>
              </Label>
              <Input
                id="c-phone"
                type="tel"
                placeholder="0300 1234567"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={!!fieldError(field)}
                className={authInputClass}
              />
              {fieldError(field) && (
                <p className={fieldErrorClass}>{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>
      </div>
      <div className="mt-4">
        <AuthError message={globalError} />
      </div>
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
      >
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            className={`group ${authSubmitClass}`}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating your clinic...
              </>
            ) : (
              <>
                Create clinic
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        )}
      </form.Subscribe>
      <p className={authAltClass}>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </p>
    </form>
  )
}
