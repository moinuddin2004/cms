import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { fieldError } from '@/components/forms/fieldError'
import { TooltipButton } from '@/components/shared/TooltipButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsCard } from '../components/SettingsCard'
import { useChangePasswordForm } from '../hooks/useChangePasswordForm'

export function SecuritySettingsPage() {
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const { form, globalError } = useChangePasswordForm()

  return (
    <DashboardLayout
      title="Password"
      subtitle="Changing it signs you out on every other device."
    >
      <SettingsCard title="Change password">
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
    </DashboardLayout>
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
