import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ErrorState,
  FieldWrapper,
  FormSection,
  FormSheet,
  FormSelect,
  LoadingSkeleton,
} from '@/components/shared'
import { fieldError } from '@/features/queue'
import { useAuthStore } from '@/store/useAuthStore'
import { useLocationThemeForm } from '../hooks/useLocationThemeForm'
import { useLocationTheme } from '../hooks/useThemeQueries'
import type { ThemeKey, ThemeKeyView } from '../types'
import { LogoField } from './LogoField'

const NO_LOCATIONS: { id: string; name: string }[] = []

const LOCKED_HINT =
  'Locked by the clinic — this location uses the clinic value.'

/** Per-location overrides of the clinic name and logos. */
export function LocationThemeSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Select the org (a stable reference), not a fresh array per render.
  const org = useAuthStore((s) =>
    s.accessibleOrganizations.find((o) => o.id === s.activeOrganizationId),
  )
  const locations = org?.locations ?? NO_LOCATIONS
  const activeLocationId = useAuthStore((s) => s.activeLocationId)
  const [locationId, setLocationId] = useState<string | null>(activeLocationId)
  useEffect(() => {
    if (open)
      setLocationId(
        (id) => id ?? activeLocationId ?? locations.at(0)?.id ?? null,
      )
  }, [open, activeLocationId, locations])

  const query = useLocationTheme(open ? locationId : null)
  const { form, readOnly } = useLocationThemeForm({
    locationId,
    view: query.data,
    onDone: () => onOpenChange(false),
  })

  const inherited = (key: ThemeKey) => {
    const v = query.data?.find((k: ThemeKeyView) => k.key === key)?.inherited
    return typeof v === 'string' ? v : ''
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Location branding"
      description="A branch can show its own name and logo. Empty fields use the clinic's."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting, s.isDirty] as const}
          >
            {([canSubmit, isSubmitting, isDirty]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting || !isDirty || !query.data}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save location branding
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <div className="space-y-6">
        <FormSelect
          label="Location"
          value={locationId ?? ''}
          onValueChange={setLocationId}
          options={locations.map((l) => ({ value: l.id, label: l.name }))}
          placeholder="Choose a location"
        />

        {query.isLoading ? (
          <LoadingSkeleton variant="detail" rows={3} />
        ) : query.isError ? (
          <ErrorState
            title="Couldn't load this location"
            onRetry={() => void query.refetch()}
          />
        ) : query.data ? (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
          >
            <FormSection title="Overrides">
              <div className="space-y-4">
                <form.Field name="app_name">
                  {(f) => (
                    <FieldWrapper
                      label="Name at this location"
                      htmlFor="loc-theme-name"
                      error={fieldError(f)}
                      hint={readOnly.has('app_name') ? LOCKED_HINT : undefined}
                    >
                      <Input
                        id="loc-theme-name"
                        value={f.state.value}
                        disabled={readOnly.has('app_name')}
                        placeholder={inherited('app_name')}
                        onChange={(e) => f.handleChange(e.target.value)}
                        onBlur={f.handleBlur}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
                <form.Field name="logo_url">
                  {(f) => (
                    <FieldWrapper
                      label="Logo (light)"
                      htmlFor="loc-theme-logo"
                      error={fieldError(f)}
                      hint={readOnly.has('logo_url') ? LOCKED_HINT : undefined}
                    >
                      <LogoField
                        id="loc-theme-logo"
                        value={f.state.value}
                        placeholderUrl={inherited('logo_url') || null}
                        disabled={readOnly.has('logo_url')}
                        onChange={f.handleChange}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
                <form.Field name="logo_dark_url">
                  {(f) => (
                    <FieldWrapper
                      label="Logo (dark)"
                      htmlFor="loc-theme-logo-dark"
                      error={fieldError(f)}
                      hint={
                        readOnly.has('logo_dark_url') ? LOCKED_HINT : undefined
                      }
                    >
                      <LogoField
                        id="loc-theme-logo-dark"
                        dark
                        value={f.state.value}
                        placeholderUrl={inherited('logo_dark_url') || null}
                        disabled={readOnly.has('logo_dark_url')}
                        onChange={f.handleChange}
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
              </div>
            </FormSection>
          </form>
        ) : null}
      </div>
    </FormSheet>
  )
}
