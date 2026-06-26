import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import apiClient from '@/lib/api'
import { toast } from 'sonner'
import { Loader2, Mail, MailCheck } from 'lucide-react'
import { AuthLayout } from './AuthLayout'

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
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-5">
            <MailCheck className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">
            Check your email
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            If an account exists with that email, we&apos;ve sent a password
            reset link.
          </p>
          <Button
            onClick={() => navigate({ to: '/login' })}
            className="w-full h-[46px] font-semibold text-[15px] rounded-[11px] cursor-pointer"
          >
            Return to Login
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      {/* Header */}
      <div className="mb-7">
        <div className="text-2xl font-extrabold tracking-tight text-foreground">
          Forgot Password
        </div>
        <div className="text-sm text-muted-foreground mt-1.5">
          Enter your email and we&apos;ll send you a reset link
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        {/* Email field */}
        <div className="mb-5">
          <Label htmlFor="forgot-email" className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 mb-[7px] block">
            Email
          </Label>
          <form.Field name="email">
            {(field) => (
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="doctor@clinic.com"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                  autoComplete="email"
                  className="h-11 pl-[38px] rounded-[10px] bg-panel border-border text-sm"
                />
              </div>
            )}
          </form.Field>
        </div>

        {/* Error */}
        {globalError && (
          <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-lg border border-destructive/20 mb-4">
            {globalError}
          </div>
        )}

        {/* Submit */}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              className="w-full h-[46px] font-semibold text-[15px] rounded-[11px] transition-all active:scale-[0.98] cursor-pointer"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send reset instructions'
              )}
            </Button>
          )}
        </form.Subscribe>

        {/* Back to login */}
        <div className="text-[13px] text-muted-foreground mt-[18px]">
          Remember your password?{' '}
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto font-semibold text-primary cursor-pointer"
            onClick={() => navigate({ to: '/login' })}
          >
            Back to login
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
