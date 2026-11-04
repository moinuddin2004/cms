import { useState } from 'react'
import { ArrowRight, Building2, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { fieldError } from '@/components/forms/fieldError'
import { cn } from '@/lib/utils'
import { AuthError, AuthHeading } from './AuthPrimitives'
import {
  authAltClass,
  authInputClass,
  authLabelClass,
  authSubmitClass,
  authTextLinkClass,
} from './authStyles'
import { useGoogleSignupStore } from '../store/useGoogleSignupStore'
import {
  useGoogleRegisterForm,
  useJoinRequestForm,
} from '../hooks/useGoogleRegisterForm'

const fieldErrorClass = 'mt-1.5 text-xs font-medium text-destructive'

/**
 * /register after "Continue with Google" found no account: create a clinic
 * with this Google login, or — when the person's Workspace domain belongs to
 * a clinic that takes join requests — ask to join it.
 */
export function GoogleRegisterPanel() {
  const profile = useGoogleSignupStore((s) => s.profile)
  const clinics = useGoogleSignupStore((s) => s.joinableClinics)
  const clear = useGoogleSignupStore((s) => s.clear)
  const [mode, setMode] = useState<'create' | 'join'>(
    clinics.length ? 'join' : 'create',
  )

  if (!profile) return null

  return (
    <>
      <AuthHeading
        title={mode === 'join' ? 'Join your clinic' : 'Create your clinic'}
        subtitle={
          <>
            Continuing with Google as{' '}
            <span className="font-medium text-foreground">{profile.email}</span>
            .
          </>
        }
      />

      {clinics.length > 0 && (
        <div
          role="radiogroup"
          aria-label="What would you like to do?"
          className="mb-6 grid grid-cols-2 gap-2"
        >
          <ModeOption
            active={mode === 'join'}
            onClick={() => setMode('join')}
            icon={UserPlus}
            label="Join a clinic"
          />
          <ModeOption
            active={mode === 'create'}
            onClick={() => setMode('create')}
            icon={Building2}
            label="New clinic"
          />
        </div>
      )}

      {mode === 'join' ? (
        <JoinForm defaultOrganizationId={clinics[0]?.id ?? ''} />
      ) : (
        <CreateForm />
      )}

      <p className={authAltClass}>
        Not you?{' '}
        <button
          type="button"
          onClick={clear}
          className={`cursor-pointer ${authTextLinkClass}`}
        >
          Use a different account
        </button>
      </p>
    </>
  )
}

function ModeOption({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof UserPlus
  label: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
        active
          ? 'border-primary bg-primary/10 text-primary-text'
          : 'border-border bg-surface text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

function CreateForm() {
  const { form, globalError } = useGoogleRegisterForm()
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="space-y-4">
        <form.Field name="clinicName">
          {(field) => (
            <div>
              <Label htmlFor="g-clinic" className={authLabelClass}>
                Clinic name
              </Label>
              <Input
                id="g-clinic"
                placeholder="City Care Clinic"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                autoComplete="organization"
                aria-invalid={!!fieldError(field)}
                className={authInputClass}
              />
              {fieldError(field) && (
                <p className={fieldErrorClass}>{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <div>
              <Label htmlFor="g-phone" className={authLabelClass}>
                Phone{' '}
                <span className="font-normal text-text-3">(optional)</span>
              </Label>
              <Input
                id="g-phone"
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
      </div>

      <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">
        New clinics are reviewed before they can be used. You can sign in with
        Google any time to check.
      </p>

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
    </form>
  )
}

function JoinForm({
  defaultOrganizationId,
}: {
  defaultOrganizationId: string
}) {
  const clinics = useGoogleSignupStore((s) => s.joinableClinics)
  const { form, globalError } = useJoinRequestForm(defaultOrganizationId)
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="space-y-4">
        <form.Field name="organizationId">
          {(field) => (
            <div>
              <p className={authLabelClass}>Clinic</p>
              <div role="radiogroup" aria-label="Clinic" className="space-y-2">
                {clinics.map((c) => (
                  <label
                    key={c.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-[14px] transition-colors',
                      field.state.value === c.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-surface hover:bg-accent',
                    )}
                  >
                    <input
                      type="radio"
                      name="join-clinic"
                      value={c.id}
                      checked={field.state.value === c.id}
                      onChange={() => field.handleChange(c.id)}
                      className="accent-primary"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
              {fieldError(field) && (
                <p className={fieldErrorClass}>{fieldError(field)}</p>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <div>
              <Label htmlFor="j-phone" className={authLabelClass}>
                Your phone
              </Label>
              <Input
                id="j-phone"
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
              <Label htmlFor="j-message" className={authLabelClass}>
                Message{' '}
                <span className="font-normal text-text-3">(optional)</span>
              </Label>
              <Textarea
                id="j-message"
                rows={3}
                placeholder="e.g. I'm the new receptionist at the main branch."
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

      <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">
        The clinic chooses your role when it accepts your request.
      </p>

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
    </form>
  )
}
