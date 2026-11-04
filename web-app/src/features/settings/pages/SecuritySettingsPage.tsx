import { useState } from 'react'
import { Eye, EyeOff, Link2Off, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { GoogleButton } from '@/features/auth'
import { formatDate } from '@/lib/datetime'
import { useAuthStore } from '@/store/useAuthStore'
import { SettingsCard } from '../components/SettingsCard'
import { useChangePasswordForm } from '../hooks/useChangePasswordForm'
import { useSetPasswordForm } from '../hooks/useSetPasswordForm'
import {
  useLinkGoogle,
  useLoginMethods,
  useUnlinkGoogle,
} from '../hooks/useLoginMethods'

/** Your sign-in methods: a linked Google account and/or a password. */
export function SecuritySettingsPage() {
  const methods = useLoginMethods()
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin)

  return (
    <DashboardLayout
      title="Sign-in methods"
      subtitle="How you sign in: with Google, with a password, or both."
    >
      {methods.isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : methods.isError || !methods.data ? (
        <ErrorState
          title="Couldn't load your sign-in methods"
          onRetry={() => void methods.refetch()}
        />
      ) : (
        <div className="space-y-6">
          {methods.data.googleConfigured && !isSuperAdmin && (
            <GoogleCard
              linked={methods.data.google}
              hasPassword={methods.data.hasPassword}
            />
          )}
          {methods.data.hasPassword ? (
            <ChangePasswordCard />
          ) : (
            <SetPasswordCard />
          )}
        </div>
      )}
    </DashboardLayout>
  )
}

function GoogleCard({
  linked,
  hasPassword,
}: {
  linked: { email: string | null; linkedAt: string } | null
  hasPassword: boolean
}) {
  const link = useLinkGoogle()
  const unlink = useUnlinkGoogle()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <SettingsCard
      title="Google"
      description={
        linked
          ? 'Sign in with your Google account instead of a password.'
          : 'Link your Google account to sign in with one click.'
      }
    >
      {linked ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {linked.email ?? 'Google account'}
            </p>
            <p className="text-sm text-text-3">
              Linked {formatDate(linked.linkedAt)}
            </p>
          </div>
          {hasPassword ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              disabled={unlink.isPending}
            >
              {unlink.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Link2Off className="mr-2 size-4" />
              )}
              Unlink
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button type="button" variant="outline" disabled>
                    <Link2Off className="mr-2 size-4" />
                    Unlink
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Set a password first, or you won&apos;t be able to sign in.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      ) : (
        <div className="max-w-sm">
          <GoogleButton
            text="continue_with"
            onCredential={(credential) => link.mutate(credential)}
            busy={link.isPending}
          />
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Unlink Google?"
        description="You will sign in with your email and password only. You can link Google again any time."
        confirmLabel="Unlink"
        destructive
        isLoading={unlink.isPending}
        onConfirm={() =>
          unlink.mutate(undefined, { onSettled: () => setConfirmOpen(false) })
        }
      />
    </SettingsCard>
  )
}

function SetPasswordCard() {
  const [showNew, setShowNew] = useState(false)
  const { form, globalError } = useSetPasswordForm()
  return (
    <SettingsCard
      title="Password"
      description="You sign in with Google only. Add a password as a second way in."
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className="max-w-md space-y-4"
      >
        <form.Field name="newPassword">
          {(field) => (
            <FieldWrapper
              label="New password"
              htmlFor="set-pwd"
              error={fieldError(field)}
            >
              <div className="relative">
                <Input
                  id="set-pwd"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={!!fieldError(field)}
                  className="h-10 pr-10"
                />
                <RevealToggle
                  shown={showNew}
                  onToggle={() => setShowNew((v) => !v)}
                />
              </div>
              {field.state.value && (
                <PasswordStrength password={field.state.value} />
              )}
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="confirmPassword">
          {(field) => (
            <FieldWrapper
              label="Confirm password"
              htmlFor="set-pwd-confirm"
              error={fieldError(field)}
            >
              <Input
                id="set-pwd-confirm"
                type="password"
                autoComplete="new-password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={!!fieldError(field)}
                className="h-10"
              />
            </FieldWrapper>
          )}
        </form.Field>
        {globalError && (
          <div className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-medium text-danger">
            {globalError}
          </div>
        )}
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="h-10"
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isSubmitting ? 'Saving…' : 'Set password'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </SettingsCard>
  )
}

function ChangePasswordCard() {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const { form, globalError } = useChangePasswordForm()

  return (
    <SettingsCard
      title="Change password"
      description="Changing it signs you out on every other device."
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        className="max-w-md space-y-4"
      >
        <form.Field name="currentPassword">
          {(field) => (
            <FieldWrapper
              label="Current password"
              htmlFor="current-pwd"
              error={fieldError(field)}
            >
              <div className="relative">
                <Input
                  id="current-pwd"
                  type={showCurrent ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={!!fieldError(field)}
                  className="h-10 pr-10"
                />
                <RevealToggle
                  shown={showCurrent}
                  onToggle={() => setShowCurrent((v) => !v)}
                />
              </div>
            </FieldWrapper>
          )}
        </form.Field>

        <form.Field name="newPassword">
          {(field) => (
            <FieldWrapper
              label="New password"
              htmlFor="new-pwd"
              error={fieldError(field)}
            >
              <div className="relative">
                <Input
                  id="new-pwd"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={!!fieldError(field)}
                  className="h-10 pr-10"
                />
                <RevealToggle
                  shown={showNew}
                  onToggle={() => setShowNew((v) => !v)}
                />
              </div>
              {field.state.value && (
                <PasswordStrength password={field.state.value} />
              )}
            </FieldWrapper>
          )}
        </form.Field>

        <form.Field name="confirmPassword">
          {(field) => (
            <FieldWrapper
              label="Confirm new password"
              htmlFor="confirm-pwd"
              error={fieldError(field)}
            >
              <Input
                id="confirm-pwd"
                type="password"
                autoComplete="new-password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={!!fieldError(field)}
                className="h-10"
              />
            </FieldWrapper>
          )}
        </form.Field>

        {globalError && (
          <div className="rounded-lg border border-danger bg-danger-soft p-3 text-sm font-medium text-danger">
            {globalError}
          </div>
        )}

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="h-10"
            >
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isSubmitting ? 'Updating…' : 'Update password'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </SettingsCard>
  )
}

function RevealToggle({
  shown,
  onToggle,
}: {
  shown: boolean
  onToggle: () => void
}) {
  return (
    <TooltipButton
      tooltip={shown ? 'Hide password' : 'Show password'}
      type="button"
      variant="ghost"
      size="sm"
      className="absolute right-0 top-0 h-full px-3 text-text-3 hover:bg-transparent hover:text-foreground"
      onClick={onToggle}
      tabIndex={-1}
    >
      {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </TooltipButton>
  )
}

function PasswordStrength({ password }: { password: string }) {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const strength =
    score <= 1
      ? { level: 1, text: 'Weak', color: 'bg-danger' }
      : score <= 2
        ? { level: 2, text: 'Fair', color: 'bg-amber' }
        : score <= 3
          ? { level: 3, text: 'Good', color: 'bg-amber' }
          : score <= 4
            ? { level: 4, text: 'Strong', color: 'bg-emerald' }
            : { level: 5, text: 'Very strong', color: 'bg-emerald' }

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i <= strength.level ? strength.color : 'bg-panel-2'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-text-3">
        Strength: <span className="font-medium">{strength.text}</span>
      </p>
    </div>
  )
}
