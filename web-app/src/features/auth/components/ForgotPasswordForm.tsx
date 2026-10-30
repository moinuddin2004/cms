import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Loader2, MailCheck } from 'lucide-react'
import { fieldError } from '@/components/forms/fieldError'
import { AuthLayout } from './AuthLayout'
import { AuthError, AuthHeading } from './AuthPrimitives'
import {
  authAltClass,
  authInputClass,
  authLabelClass,
  authSubmitClass,
  authTextLinkClass,
} from './authStyles'
import { useForgotPasswordForm } from '../hooks/useForgotPasswordForm'

const fieldErrorClass = 'mt-1.5 text-xs font-medium text-destructive'

export function ForgotPasswordForm() {
  const navigate = useNavigate()
  const { form, globalError, success } = useForgotPasswordForm()

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-text">
            <MailCheck className="size-7" />
          </div>
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground">
            Check your email
          </h1>
          <p className="mx-auto mt-2 mb-8 max-w-[320px] text-[13.5px] leading-relaxed text-muted-foreground">
            If an account exists with that email, we&rsquo;ve sent a password
            reset link.
          </p>
          <Button
            onClick={() => navigate({ to: '/login' })}
            className={authSubmitClass}
          >
            Return to sign in
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthHeading
        title="Reset your password"
        subtitle="Enter your email and we'll send you a reset link."
      />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        {/* Email field */}
        <div>
          <Label htmlFor="forgot-email" className={authLabelClass}>
            Email
          </Label>
          <form.Field name="email">
            {(field) => (
              <>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="doctor@clinic.com"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  autoComplete="email"
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
                  Sending...
                </>
              ) : (
                <>
                  Send reset link
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          )}
        </form.Subscribe>

        <p className={authAltClass}>
          Remember your password?{' '}
          <button
            type="button"
            onClick={() => navigate({ to: '/login' })}
            className={`cursor-pointer ${authTextLinkClass}`}
          >
            Back to sign in
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
