import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  Link2Off,
  Loader2,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { fieldError } from '@/components/forms/fieldError'
import { LoadingSkeleton } from '@/components/feedback/LoadingSkeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { AuthLayout } from '../components/AuthLayout'
import { AuthError, AuthHeading } from '../components/AuthPrimitives'
import {
  authAltClass,
  authInputClass,
  authLabelClass,
  authSubmitClass,
  authTextLinkClass,
} from '../components/authStyles'
import { GoogleButton } from '../google/GoogleButton'
import { fetchInviteInfo } from '../services/google.api'
import { useInviteJoinForm } from '../hooks/useInviteJoinForm'

const fieldErrorClass = 'mt-1.5 text-xs font-medium text-destructive'

/**
 * `/join/$token` — a clinic's invite link. Pick a Google account, add a
 * phone number, and a join request goes to the clinic; the owner approves
 * it under Employees and chooses the role.
 */
export function JoinInvitePage({ token }: { token: string }) {
  const info = useQuery({
    queryKey: ['join-invite', token],
    queryFn: () => fetchInviteInfo(token),
    retry: false,
  })

  return (
    <AuthLayout>
      {info.isLoading ? (
        <LoadingSkeleton variant="detail" />
      ) : info.isError ? (
        <ErrorState
          title="Couldn't open this invite"
          onRetry={() => void info.refetch()}
        />
      ) : !info.data?.valid ? (
        <InvalidInvite />
      ) : !info.data.googleEnabled ? (
        <InvalidInvite reason="This clinic doesn't use Google sign-in. Ask the owner to add you under Employees." />
      ) : (
        <JoinForm token={token} clinicName={info.data.clinicName} />
      )}
    </AuthLayout>
  )
}

function InvalidInvite({ reason }: { reason?: string }) {
  return (
    <>
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-panel-2 text-muted-foreground">
        <Link2Off className="size-6" />
      </div>
      <AuthHeading
        title="This invite link doesn't work"
        subtitle={
          reason ??
          'It has expired or was turned off. Ask your clinic for a new link.'
        }
      />
      <Button asChild variant="outline" className={authSubmitClass}>
        <Link to="/login">Go to sign in</Link>
      </Button>
    </>
  )
}

function JoinForm({
  token,
  clinicName,
}: {
  token: string
  clinicName: string
}) {
  const [credential, setCredential] = useState<string | null>(null)
  const { form, globalError } = useInviteJoinForm(token, credential)

  return (
    <>
      <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <UserPlus className="size-6" />
      </div>
      <AuthHeading
        title={`Join ${clinicName}`}
        subtitle="Sign in with Google and send a request. The clinic chooses your role when it accepts."
      />

      {!credential ? (
        <GoogleButton text="continue_with" onCredential={setCredential} />
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <p className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px] text-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            Google account selected
          </p>
          <div className="space-y-4">
            <form.Field name="phone">
              {(field) => (
                <div>
                  <Label htmlFor="inv-phone" className={authLabelClass}>
                    Your phone
                  </Label>
                  <Input
                    id="inv-phone"
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
                </div>
              )}
            </form.Field>
            <form.Field name="message">
              {(field) => (
                <div>
                  <Label htmlFor="inv-message" className={authLabelClass}>
                    Message{' '}
                    <span className="font-normal text-text-3">(optional)</span>
                  </Label>
                  <Textarea
                    id="inv-message"
                    rows={3}
                    placeholder="e.g. I'm the new receptionist."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={!!fieldError(field)}
                    className="rounded-xl"
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
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
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
                    Sending request...
                  </>
                ) : (
                  <>
                    Send join request
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            )}
          </form.Subscribe>

          <p className={authAltClass}>
            <button
              type="button"
              onClick={() => setCredential(null)}
              className={`cursor-pointer ${authTextLinkClass}`}
            >
              Use a different Google account
            </button>
          </p>
        </form>
      )}
    </>
  )
}
