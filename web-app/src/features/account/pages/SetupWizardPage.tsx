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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import apiClient from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import { useClinicSetup, useCompleteSetup } from '../hooks/useAccount'
import {
  useSetupClinicForm,
  useSetupLocationForm,
} from '../hooks/useSetupForms'
import { fieldError } from '../lib/fieldError'
import { SPECIALTY_OPTIONS } from '../types'
import type { ClinicSetup } from '../types'

const TIMEZONES = [
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Qatar',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Europe/London',
  'America/New_York',
  'UTC',
]
const CURRENCIES = ['PKR', 'AED', 'SAR', 'QAR', 'INR', 'BDT', 'GBP', 'USD', 'EUR']

const STEPS = [
  { key: 'clinic', label: 'Clinic', icon: Building2 },
  { key: 'location', label: 'Location & tax', icon: MapPin },
  { key: 'team', label: 'Your team', icon: Users },
] as const

function errorMessage(err: unknown) {
  const msg = (err as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message
  return Array.isArray(msg) ? String(msg[0]) : (msg as string) || 'Could not save. Try again.'
}

/** Re-read the session so the sidebar/forms pick up the new name, currency, specialties. */
async function refreshSession() {
  try {
    const { data } = await apiClient.get('/auth/me')
    const me = data?.data
    if (!me) return
    const s = useAuthStore.getState()
    s.setAuth({
      user: me.user,
      accessToken: me.accessToken,
      isSuperAdmin: me.isSuperAdmin,
      accessSource: me.accessSource,
      requiresOrgSelection: false,
      requiresLocationSelection: false,
      accessibleOrganizations: me.accessibleOrganizations,
      activeOrganizationId: s.activeOrganizationId,
      activeLocationId: s.activeLocationId,
      labMemberships: me.labMemberships ?? [],
    })
  } catch {
    // The old values stay until the next refresh — harmless.
  }
}

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

function ClinicStep({
  setup,
  onNext,
}: {
  setup: ClinicSetup
  onNext: () => void
}) {
  const { form, save } = useSetupClinicForm(setup, onNext)
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
          <FieldWrapper label="Clinic name" htmlFor="setup-name" required error={fieldError(f)}>
            <Input
              id="setup-name"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
            />
          </FieldWrapper>
        )}
      </form.Field>

      <form.Field name="specialtyTags">
        {(f) => (
          <FieldWrapper
            label="What kind of clinic is it?"
            required
            hint="Pick every type that applies — it decides which tools you see."
            error={fieldError(f)}
          >
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((o) => {
                const on = f.state.value.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      f.handleChange(
                        on
                          ? f.state.value.filter((v) => v !== o.value)
                          : [...f.state.value, o.value],
                      )
                    }
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors',
                      on
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>
          </FieldWrapper>
        )}
      </form.Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="phone">
          {(f) => (
            <FieldWrapper label="Phone" htmlFor="setup-phone" error={fieldError(f)}>
              <Input
                id="setup-phone"
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
            <FieldWrapper label="Clinic email" htmlFor="setup-email" error={fieldError(f)}>
              <Input
                id="setup-email"
                type="email"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="timezone">
          {(f) => (
            <FieldWrapper label="Timezone" required error={fieldError(f)}>
              <Select value={f.state.value} onValueChange={f.handleChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(TIMEZONES.includes(f.state.value)
                    ? TIMEZONES
                    : [f.state.value, ...TIMEZONES]
                  ).map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="currency">
          {(f) => (
            <FieldWrapper label="Currency" required error={fieldError(f)}>
              <Select value={f.state.value} onValueChange={f.handleChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(CURRENCIES.includes(f.state.value)
                    ? CURRENCIES
                    : [f.state.value, ...CURRENCIES]
                  ).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          )}
        </form.Field>
      </div>

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={!canSubmit || isSubmitting || save.isPending}>
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
            hint="Your first branch. You can add more under Locations later."
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
          <FieldWrapper label="Address" htmlFor="loc-address" error={fieldError(f)}>
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
            <FieldWrapper label="Phone" htmlFor="loc-phone" error={fieldError(f)}>
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
            <FieldWrapper label="Email" htmlFor="loc-email" error={fieldError(f)}>
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
              <Input
                id="loc-tax"
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={Number.isNaN(f.state.value) ? '' : f.state.value}
                onChange={(e) => f.handleChange(e.target.valueAsNumber)}
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
            <Button type="submit" disabled={!canSubmit || isSubmitting || save.isPending}>
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
        person gets a role (Doctor, Receptionist, …) that decides what they
        can see. You can also do this later from the sidebar.
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
            <strong className="font-semibold">User Admin</strong> — give a staff
            member a login.
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
            A few details so invoices, schedules and reports come out right.
            You can change all of this later in settings.
          </p>
          <Stepper step={step} />
          {setup.isLoading ? (
            <LoadingSkeleton variant="detail" />
          ) : setup.isError || !setup.data ? (
            <ErrorState onRetry={() => void setup.refetch()} />
          ) : step === 0 ? (
            <ClinicStep setup={setup.data} onNext={() => setStep(1)} />
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
