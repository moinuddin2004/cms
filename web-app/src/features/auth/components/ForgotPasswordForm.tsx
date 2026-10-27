import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import { ArrowRight, Loader2, MailCheck } from 'lucide-react'
import { AuthLayout } from './AuthLayout'
import { AuthError, AuthHeading } from './AuthPrimitives'
import {
  authAltClass,
  authInputClass,
  authLabelClass,
  authSubmitClass,
  authTextLinkClass,
} from './authStyles'

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email'),
})

export function ForgotPasswordForm() {
  const [globalError, setGlobalError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      setGlobalError('')
      try {
        const parsed = forgotSchema.parse(value)
        await apiClient.post('/auth/forgot-password', parsed)
        setSuccess(true)
        toast.success('Reset link sent!', {
          description: 'Check your email inbox.',
        })
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          setGlobalError(err.issues[0].message)
        } else {
          setGlobalError(
            err.response?.data?.message ||
              'Failed to process request. Try again.',
          )
        }
      }
    },
  })

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
              <Input
                id="forgot-email"
                type="email"
                placeholder="doctor@clinic.com"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required
                autoComplete="email"
                className={authInputClass}
              />
            )}
          </form.Field>
        </div>

        <div className="mt-4">
          <AuthError message={globalError} />
        </div>

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              className={`group ${authSubmitClass}`}
              disabled={isSubmitting}
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
