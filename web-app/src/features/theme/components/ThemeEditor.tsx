import { useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { useThemeForm } from '../hooks/useThemeForm'
import type { ThemeScope } from '../hooks/useThemeForm'
import type { ThemeKey, ThemeKeyView, ThemeUpdate } from '../types'
import { ThemeControls } from './ThemeControls'
import { ThemePreview } from './ThemePreview'

const COPY: Record<
  ThemeScope,
  { lockLabel: string; resetTitle: string; resetBody: string; save: string }
> = {
  org: {
    lockLabel: "Locations can't override",
    resetTitle: 'Reset to default?',
    resetBody:
      "Your clinic's name, logos, colours and locks are cleared, so the platform defaults apply again. Location overrides are kept.",
    save: 'Save theme',
  },
  platform: {
    lockLabel: "Clinics can't change",
    resetTitle: 'Reset platform defaults?',
    resetBody:
      'Every platform default and lock is cleared, so the built-in look applies to clinics that set nothing.',
    save: 'Save defaults',
  },
}

/**
 * Controls on the left, live preview on the right, for one scope. Save is
 * enabled only when the form is dirty and valid.
 */
export function ThemeEditor({
  scope,
  view,
  isLoading,
  isError,
  onRetry,
  onSave,
  isSaving,
}: {
  scope: ThemeScope
  view: ThemeKeyView[] | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  onSave: (update: ThemeUpdate) => Promise<unknown>
  isSaving: boolean
}) {
  const { form, readOnly } = useThemeForm({ view, scope, onSave })
  const [confirmReset, setConfirmReset] = useState(false)
  const copy = COPY[scope]

  if (isLoading) return <LoadingSkeleton variant="detail" />
  if (isError || !view) {
    return (
      <ErrorState
        title="Couldn't load the theme"
        description="Check your connection and try again."
        onRetry={onRetry}
      />
    )
  }

  // Org: lock only what locations can override. Platform: every key.
  const lockable = view
    .filter(
      (k) =>
        k.lockable && (scope === 'platform' || k.scopes.includes('location')),
    )
    .map((k) => k.key)
  const inherited = Object.fromEntries(
    view.map((k) => [
      k.key,
      typeof k.inherited === 'string' ? k.inherited : '',
    ]),
  ) as Partial<Record<ThemeKey, string>>

  const hasOwnValues = view.some((k) => {
    const cell = scope === 'platform' ? k.platform : k.org
    return !k.lockedAbove && (cell?.value != null || cell?.locked)
  })

  const reset = async () => {
    const values: ThemeUpdate['values'] = {}
    const locks: ThemeUpdate['locks'] = {}
    for (const k of view) {
      if (k.lockedAbove) continue
      const cell = scope === 'platform' ? k.platform : k.org
      if (cell?.value != null) values[k.key] = null
      if (cell?.locked) locks[k.key] = false
    }
    await onSave({ values, locks })
    setConfirmReset(false)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <Card className="py-5">
        <CardContent className="px-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
            className="space-y-6"
          >
            <ThemeControls
              form={form}
              readOnly={readOnly}
              lockable={lockable}
              lockLabel={copy.lockLabel}
            />
            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={!hasOwnValues || isSaving}
                onClick={() => setConfirmReset(true)}
              >
                <RotateCcw className="size-4" />
                Reset to default
              </Button>
              <form.Subscribe
                selector={(s) =>
                  [s.canSubmit, s.isSubmitting, s.isDirty] as const
                }
              >
                {([canSubmit, isSubmitting, isDirty]) => (
                  <Button
                    type="submit"
                    disabled={!canSubmit || isSubmitting || !isDirty}
                  >
                    {isSubmitting && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {copy.save}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <form.Subscribe selector={(s) => s.values.values}>
          {(values) => <ThemePreview values={values} inherited={inherited} />}
        </form.Subscribe>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={copy.resetTitle}
        description={copy.resetBody}
        confirmLabel="Reset"
        destructive
        isLoading={isSaving}
        onConfirm={() => void reset()}
      />
    </div>
  )
}
