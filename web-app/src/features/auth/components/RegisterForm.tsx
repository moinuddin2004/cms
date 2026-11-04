import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { fieldError } from '@/components/forms/fieldError'
import { AuthLayout } from './AuthLayout'
import { AuthError, AuthHeading } from './AuthPrimitives'
import { PasswordStrength } from './PasswordStrength'
import {
  authAltClass,
  authInputClass,
  authInputWithActionClass,
  authLabelClass,
  authSubmitClass,
  authTextLinkClass,
} from './authStyles'
import { useRegisterForm } from '../hooks/useRegisterForm'
import {
  AuthDivider,
  GoogleButton,
  useGoogleConfig,
} from '../google/GoogleButton'
import { useGoogleSignIn } from '../google/useGoogleSignIn'
import { useGoogleSignupStore } from '../store/useGoogleSignupStore'
import { GoogleRegisterPanel } from './GoogleRegisterPanel'

const fieldErrorClass = 'mt-1.5 text-xs font-medium text-destructive'

export function RegisterForm() {
  const googlePending = useGoogleSignupStore((s) => !!s.credential)
  return (
    <AuthLayout>
      {googlePending ? <GoogleRegisterPanel /> : <EmailRegisterForm />}
    </AuthLayout>
  )
}

function EmailRegisterForm() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const { form, globalError } = useRegisterForm()
  const google = useGoogleSignIn()
  const { data: googleConfig } = useGoogleConfig()

  return (
    <>
      <AuthHeading
        title="Create your clinic"
        subtitle="Set up your clinic in a minute. We review new clinics before they go live."
      />

      {googleConfig?.enabled && (
        <>
          <GoogleButton
            text="signup_with"
            onCredential={google.onCredential}
            busy={google.busy}
          />
          {google.error ? (
            <div className="mt-4">
              <AuthError message={google.error} />
            </div>
          ) : null}
          <AuthDivider label="or sign up with email" />
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
          {/* Clinic name */}
          <div>
            <Label htmlFor="register-clinic" className={authLabelClass}>
              Clinic name
            </Label>
            <form.Field name="clinicName">
              {(field) => (
                <>
                  <Input
                    id="register-clinic"
                    placeholder="City Care Clinic"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    autoComplete="organization"
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

          {/* Name */}
          <div>
            <Label htmlFor="register-name" className={authLabelClass}>
              Your name
            </Label>
            <form.Field name="name">
              {(field) => (
                <>
                  <Input
                    id="register-name"
                    placeholder="Dr. John Doe"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                    autoComplete="name"
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

          {/* Email */}
          <div>
            <Label htmlFor="register-email" className={authLabelClass}>
              Email
            </Label>
            <form.Field name="email">
              {(field) => (
                <>
                  <Input
                    id="register-email"
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

          {/* Phone */}
          <div>
            <Label htmlFor="register-phone" className={authLabelClass}>
              Phone <span className="font-normal text-text-3">(optional)</span>
            </Label>
            <form.Field name="phone">
              {(field) => (
                <>
                  <Input
                    id="register-phone"
                    type="tel"
                    placeholder="0300 1234567"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    autoComplete="tel"
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
            <Label htmlFor="register-password" className={authLabelClass}>
              Password
            </Label>
            <form.Field name="password">
              {(field) => (
                <>
                  <div className="relative">
                    <Input
                      id="register-password"
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
                </>
              )}
            </form.Field>
            <form.Field name="password">
              {(field) =>
                field.state.value ? (
                  <div className="mt-2.5">
                    <PasswordStrength password={field.state.value} />
                  </div>
                ) : null
              }
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
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => navigate({ to: '/login' })}
            className={`cursor-pointer ${authTextLinkClass}`}
          >
            Sign in
          </button>
        </p>
      </form>
    </>
  )
}
