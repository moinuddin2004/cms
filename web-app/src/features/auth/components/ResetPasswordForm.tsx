import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { fieldError } from '@/components/forms/fieldError'
import { AuthLayout } from './AuthLayout'
import { AuthError, AuthHeading } from './AuthPrimitives'
import { PasswordStrength } from './PasswordStrength'
import {
  authInputClass,
  authInputWithActionClass,
  authLabelClass,
  authSubmitClass,
} from './authStyles'
import { useResetPasswordForm } from '../hooks/useResetPasswordForm'

const fieldErrorClass = 'mt-1.5 text-xs font-medium text-destructive'

export function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const token = (search as any)?.token || ''
  const { form, globalError, success } = useResetPasswordForm(token)

  if (!token) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="mb-2 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            This reset link is invalid
          </h1>
          <p className="mx-auto mb-8 max-w-[320px] text-[13.5px] leading-relaxed text-muted-foreground">
            The link is missing its token or has expired. Request a new one to
            continue.
          </p>
          <Button
            onClick={() => navigate({ to: '/forgot-password' })}
            className={authSubmitClass}
          >
            Request a new link
          </Button>
        </div>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
            <ShieldCheck className="size-7" />
          </div>
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            Password updated
          </h1>
          <p className="mx-auto mt-2 mb-8 max-w-[320px] text-[13.5px] leading-relaxed text-muted-foreground">
            Your password has been changed. All other sessions have been signed
            out for security.
          </p>
          <Button
            onClick={() => navigate({ to: '/login' })}
            className={authSubmitClass}
          >
            Go to sign in
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthHeading
        title="Choose a new password"
        subtitle="Your other sessions will be signed out for security."
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="space-y-4">
          {/* New password */}
          <div>
            <Label htmlFor="new-password" className={authLabelClass}>
              New password
            </Label>
            <form.Field name="newPassword">
              {(field) => (
                <>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      required
                      autoComplete="new-password"
                      aria-invalid={!!fieldError(field)}
                      className={authInputWithActionClass}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/25"
                    >
                      {showPassword ? (
                        <EyeOff className="size-[17px]" />
                      ) : (
                        <Eye className="size-[17px]" />
                      )}
                    </button>
                  </div>
                  {fieldError(field) && (
                    <p className={fieldErrorClass}>{fieldError(field)}</p>
                  )}
                  {field.state.value && (
                    <div className="mt-2.5">
                      <PasswordStrength password={field.state.value} />
                    </div>
                  )}
                </>
              )}
            </form.Field>
          </div>

          {/* Confirm password */}
          <div>
            <Label htmlFor="confirm-password" className={authLabelClass}>
              Confirm password
            </Label>
            <form.Field name="confirmPassword">
              {(field) => (
                <>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Enter it again"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    autoComplete="new-password"
                    aria-invalid={!!fieldError(field)}
                    className={authInputClass}
                  />
                  {fieldError(field) && (
                    <p className={fieldErrorClass}>{fieldError(field)}</p>
                  )}
                </>
              )}
            </form.Field>
          </div>
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
                  Resetting...
                </>
              ) : (
                <>
                  Reset password
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthLayout>
  )
}
