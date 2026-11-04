import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { fieldError } from '@/components/forms/fieldError'
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { AuthError, AuthHeading } from './AuthPrimitives'
import {
  authAltClass,
  authInputClass,
  authInputWithActionClass,
  authLabelClass,
  authSubmitClass,
  authTextLinkClass,
} from './authStyles'
import { useLoginForm } from '../hooks/useLoginForm'
import {
  AuthDivider,
  GoogleButton,
  useGoogleConfig,
} from '../google/GoogleButton'
import { useGoogleSignIn } from '../google/useGoogleSignIn'

const fieldErrorClass = 'mt-1.5 text-xs font-medium text-destructive'

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const { form, globalError } = useLoginForm()
  const google = useGoogleSignIn()
  const { data: googleConfig } = useGoogleConfig()

  return (
    <AuthLayout>
      <AuthHeading
        title="Welcome back"
        subtitle="Sign in to continue to your clinic workspace."
      />

      {googleConfig?.enabled && (
        <>
          <GoogleButton
            text="signin_with"
            onCredential={google.onCredential}
            busy={google.busy}
          />
          {google.error ? (
            <div className="mt-4">
              <AuthError message={google.error} />
            </div>
          ) : null}
          <AuthDivider label="or sign in with email" />
        </>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="space-y-4">
          {/* Email */}
          <div>
            <Label htmlFor="login-email" className={authLabelClass}>
              Email
            </Label>
            <form.Field name="email">
              {(field) => (
                <>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@clinic.com"
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

          {/* Password */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <Label
                htmlFor="login-password"
                className={`${authLabelClass} mb-0`}
              >
                Password
              </Label>
              <button
                type="button"
                onClick={() => navigate({ to: '/forgot-password' })}
                className="cursor-pointer text-[12.5px] font-medium text-primary-text underline-offset-4 outline-none hover:underline focus-visible:underline"
              >
                Forgot password?
              </button>
            </div>
            <form.Field name="password">
              {(field) => (
                <>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      required
                      autoComplete="current-password"
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
                </>
              )}
            </form.Field>
          </div>
        </div>

        {/* Keep me signed in */}
        <form.Field name="rememberMe">
          {(field) => (
            <div className="mt-4 mb-5">
              <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[13px] text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-border bg-surface transition-colors peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-background"
                >
                  {field.state.value && (
                    <Check
                      className="size-3 text-primary-foreground"
                      strokeWidth={3}
                    />
                  )}
                </span>
                Keep me signed in
              </label>
              {/* <p className="mt-1.5 pl-[28px] text-[11.5px] text-muted-foreground/80">
                Otherwise you&rsquo;ll be signed out after 1 day.
              </p> */}
            </div>
          )}
        </form.Field>

        {globalError ? (
          <div className="mt-4">
            <AuthError message={globalError} />
          </div>
        ) : null}

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
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          )}
        </form.Subscribe>

        <p className={authAltClass}>
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => navigate({ to: '/register' })}
            className={`cursor-pointer ${authTextLinkClass}`}
          >
            Sign up
          </button>
        </p>
      </form>
    </AuthLayout>
  )
}
