import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Building2,
  Check,
  Loader2,
  MapPin,
  PartyPopper,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { BrandMark } from '@/components/layout/BrandMark'
import { ErrorState, FieldWrapper, LoadingSkeleton } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/forms/NumberInput'
import { cn } from '@/lib/utils'
import { ClinicDetailsForm } from '../components/ClinicDetailsForm'
import { useClinicSetup, useCompleteSetup } from '../hooks/useAccount'
import { useSetupLocationForm } from '../hooks/useSetupForms'
import { fieldError } from '../lib/fieldError'
import { errorMessage, refreshSession } from '../lib/session'
import type { ClinicSetup } from '../types'

const STEPS = [
  { key: 'clinic', label: 'Clinic', icon: Building2 },
  { key: 'location', label: 'Location & tax', icon: MapPin },
  { key: 'team', label: 'Your team', icon: Users },
] as const

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = i < step
        const current = i === step
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                done && 'border-primary bg-primary text-primary-foreground',
                current && 'border-primary text-primary',
                !done && !current && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span
              className={cn(
                'hidden text-sm font-medium sm:inline',
                current ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-1 h-px flex-1 bg-border" />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function LocationStep({
  setup,
  onBack,
  onNext,
}: {
  setup: ClinicSetup
  onBack: () => void
  onNext: () => void
}) {
  const { form, save } = useSetupLocationForm(setup, onNext)
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit().catch((err) => toast.error(errorMessage(err)))
      }}
    >
      <form.Field name="name">
        {(f) => (
          <FieldWrapper
            label="Location name"
            htmlFor="loc-name"
            required
            hint="Your first branch. You can add more later in Settings → Locations."
            error={fieldError(f)}
          >
            <Input
              id="loc-name"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
            />
          </FieldWrapper>
        )}
      </form.Field>
      <form.Field name="address">
        {(f) => (
          <FieldWrapper
            label="Address"
            htmlFor="loc-address"
            error={fieldError(f)}
          >
            <Input
              id="loc-address"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
            />
          </FieldWrapper>
        )}
      </form.Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="city">
          {(f) => (
            <FieldWrapper label="City" htmlFor="loc-city" error={fieldError(f)}>
              <Input
                id="loc-city"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="phone">
          {(f) => (
            <FieldWrapper
              label="Phone"
              htmlFor="loc-phone"
              error={fieldError(f)}
            >
              <Input
                id="loc-phone"
                inputMode="tel"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="email">
          {(f) => (
            <FieldWrapper
              label="Email"
              htmlFor="loc-email"
              error={fieldError(f)}
            >
              <Input
                id="loc-email"
                type="email"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="taxRate">
          {(f) => (
            <FieldWrapper
              label="Sales tax on invoices (%)"
              htmlFor="loc-tax"
              hint="Added on top of each patient invoice. Leave 0 for no tax."
              error={fieldError(f)}
            >
              <NumberInput
                id="loc-tax"
                mode="decimal"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </div>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-between pt-2">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting || save.isPending}
            >
              {(isSubmitting || save.isPending) && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Save & continue
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  )
}

function TeamStep({ onBack }: { onBack: () => void }) {
  const complete = useCompleteSetup()
  const navigate = useNavigate()
  const finish = () =>
    complete.mutate(undefined, {
      onSuccess: async () => {
        await refreshSession()
        toast.success('Your clinic is ready')
        void navigate({ to: '/', replace: true })
      },
      onError: (err) => toast.error(errorMessage(err)),
    })

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Add your doctors and front-desk staff whenever you are ready — each
        person gets a role (Doctor, Receptionist, …) that decides what they can
        see. You can also do this later.
      </p>
      <ul className="space-y-2 text-sm">
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 text-primary" />
          <span>
            <strong className="font-semibold">Employees</strong> — add staff,
            their schedules and salaries.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 text-primary" />
          <span>
            <strong className="font-semibold">Settings → Users</strong> — give a
            staff member a login.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 text-primary" />
          <span>
            <strong className="font-semibold">Patients → Import</strong> — bring
            your existing patients from Excel.
          </span>
        </li>
      </ul>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={finish} disabled={complete.isPending}>
          {complete.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <PartyPopper className="mr-2 size-4" />
          )}
          Finish setup
        </Button>
      </div>
    </div>
  )
}

/** One-time setup for a clinic that just signed up (owner only). */
export function SetupWizardPage() {
  const [step, setStep] = useState(0)
  const setup = useClinicSetup()

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <BrandMark />
          {setup.data && !setup.data.onboardingPending && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Back to the app</Link>
            </Button>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Set up your clinic
          </h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            A few details so invoices, schedules and reports come out right. You
            can change all of this later in settings.
          </p>
          <Stepper step={step} />
          {setup.isLoading ? (
            <LoadingSkeleton variant="detail" />
          ) : setup.isError || !setup.data ? (
            <ErrorState onRetry={() => void setup.refetch()} />
          ) : step === 0 ? (
            <ClinicDetailsForm
              mode="wizard"
              setup={setup.data}
              onSaved={() => setStep(1)}
            />
          ) : step === 1 ? (
            <LocationStep
              setup={setup.data}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
            />
          ) : (
            <TeamStep onBack={() => setStep(1)} />
          )}
        </div>
      </div>
    </div>
  )
}
