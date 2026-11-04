import type { ReactNode } from 'react'
import { Info, Lock } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  EmptyState,
  ErrorState,
  FieldWrapper,
  LoadingSkeleton,
  fieldError,
} from '@/components/shared'
import { SaveBar } from '@/components/shared/SaveBar'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useAccess } from '@/features/access'
import { useSignInPolicy, useSignInPolicyForm } from '../hooks/useSignInPolicy'
import type { SignInPolicyResponse } from '../types'

/**
 * Settings → Sign-in policy (owner only): allow Google, require it,
 * restrict it to the clinic's Google Workspace domains, and let people from
 * those domains ask to join.
 */
export function SignInPolicyPage() {
  const { isOwner } = useAccess()
  return (
    <DashboardLayout
      title="Sign-in policy"
      subtitle="How your team may sign in to this clinic."
    >
      {isOwner ? (
        <PolicyContent />
      ) : (
        <EmptyState
          icon={Lock}
          title="Only the clinic owner can change this"
          description="Ask the owner to update how the team signs in."
        />
      )}
    </DashboardLayout>
  )
}

function PolicyContent() {
  const query = useSignInPolicy()
  if (query.isLoading) return <LoadingSkeleton variant="detail" />
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => void query.refetch()} />
  }
  if (!query.data.googleConfigured) {
    return (
      <EmptyState
        icon={Info}
        title="Google sign-in isn't set up"
        description="Google sign-in hasn't been switched on for this platform yet. Your team signs in with email and password."
      />
    )
  }
  return <PolicyForm data={query.data} />
}

function PolicyForm({ data }: { data: SignInPolicyResponse }) {
  const { form, globalError } = useSignInPolicyForm(data.policy)
  const viaGoogle = data.sessionMethod === 'google'

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
      className="max-w-3xl space-y-6"
    >
      <div className="rounded-xl border border-border bg-surface">
        <form.Field name="googleEnabled">
          {(field) => (
            <SwitchRow
              id="policy-google"
              title="Allow Google sign-in"
              description="Staff can sign in with their Google account. Their role still comes from Employees."
              checked={field.state.value}
              onChange={(v) => {
                field.handleChange(v)
                if (!v) {
                  form.setFieldValue('requireGoogle', false)
                  form.setFieldValue('joinRequestsEnabled', false)
                }
              }}
              error={fieldError(field)}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(s) => s.values.googleEnabled}>
          {(googleEnabled) => (
            <>
              <form.Field name="requireGoogle">
                {(field) => (
                  <SwitchRow
                    id="policy-require"
                    title="Require Google sign-in"
                    description={
                      viaGoogle
                        ? 'Passwords stop working for this clinic. Everyone must continue with Google.'
                        : 'Passwords stop working for this clinic. Sign in with Google yourself first, so you are not locked out.'
                    }
                    checked={field.state.value}
                    disabled={
                      !googleEnabled || (!viaGoogle && !field.state.value)
                    }
                    onChange={field.handleChange}
                    error={fieldError(field)}
                  />
                )}
              </form.Field>

              <form.Field name="googleDomains">
                {(field) => (
                  <div className="border-t border-border px-5 py-4">
                    <FieldWrapper
                      label="Allowed Google Workspace domains"
                      htmlFor="policy-domains"
                      error={fieldError(field)}
                      hint="Leave empty to allow any Google account. With domains set, only work accounts from them can sign in with Google (personal Gmail can't)."
                    >
                      <Input
                        id="policy-domains"
                        placeholder="myclinic.com"
                        value={field.state.value}
                        disabled={!googleEnabled}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={!!fieldError(field)}
                        className="h-10 max-w-md"
                      />
                    </FieldWrapper>
                    {viaGoogle && data.sessionDomain === null && (
                      <p className="mt-2 text-xs text-text-3">
                        You signed in with a personal Google account — setting
                        domains would lock you out unless you also sign in with
                        a password.
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name="joinRequestsEnabled">
                {(field) => (
                  <SwitchRow
                    id="policy-join"
                    title="Let people from these domains ask to join"
                    description="Someone signing in with Google from your domain can send a join request. You approve it under Employees and choose their role."
                    checked={field.state.value}
                    disabled={!googleEnabled}
                    onChange={field.handleChange}
                    error={fieldError(field)}
                  />
                )}
              </form.Field>
            </>
          )}
        </form.Subscribe>
      </div>

      {globalError && (
        <div className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-medium text-danger">
          {globalError}
        </div>
      )}

      <form.Subscribe
        selector={(s) =>
          [s.canSubmit, s.isSubmitting, !s.isDefaultValue] as const
        }
      >
        {([canSubmit, isSubmitting, isDirty]) => (
          <SaveBar
            dirty={isDirty}
            saving={isSubmitting}
            canSave={canSubmit}
            onSave={() => void form.handleSubmit()}
            onDiscard={() => form.reset()}
          />
        )}
      </form.Subscribe>
    </form>
  )
}

function SwitchRow({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
  error,
}: {
  id: string
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  error?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-t border-border px-5 py-4 first:border-t-0">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {title}
        </label>
        <p className="mt-0.5 text-[13px] text-text-3">{description}</p>
        {error && (
          <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={title}
      />
    </div>
  )
}
