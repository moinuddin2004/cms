import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { NumberInput } from '@/components/forms/NumberInput'
import { FieldWrapper, FormSheet } from '@/components/shared'
import { fieldError } from '@/features/queue'
import {
  useLabBillingMutation,
  useLabBillingSettings,
} from '../hooks/useLabBilling'
import { percentToBp } from '../schemas/lab-billing.schema'
import { labBillingApi } from '../services/lab-billing.api'

const settingsSchema = z.object({
  taxPercent: z
    .string()
    .refine(
      (v) => percentToBp(v || '0') !== null,
      'A percentage from 0 to 100',
    ),
  dueDays: z
    .string()
    .refine(
      (v) => /^\d{1,3}$/.test(v) && Number(v) <= 365,
      'Whole days, 0 to 365',
    ),
})

/** Lab billing defaults: tax rate (basis points, default 0) and payment terms. */
export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const settings = useLabBillingSettings()
  const save = useLabBillingMutation(
    labBillingApi.updateSettings,
    'Settings saved',
  )
  const initial = {
    taxPercent: String((settings.data?.taxRateBp ?? 0) / 100),
    dueDays: String(settings.data?.dueDays ?? 0),
  }
  const form = useForm({
    defaultValues: initial,
    validators: { onChange: settingsSchema, onSubmit: settingsSchema },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        taxRateBp: percentToBp(value.taxPercent || '0') ?? 0,
        dueDays: Number(value.dueDays),
      })
      onOpenChange(false)
    },
  })
  useEffect(() => {
    if (open) form.reset(initial)
  }, [open, form, settings.data])

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Lab billing settings"
      description="Defaults for new lab invoices. Issued invoices keep the values they were issued with."
      widthClassName="sm:max-w-md"
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
                disabled={!canSubmit || isSubmitting || !isDirty}
                onClick={() => void form.handleSubmit()}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="taxPercent">
          {(f) => (
            <FieldWrapper
              label="Tax on lab work (%)"
              htmlFor="lb-tax"
              error={fieldError(f)}
              hint="0 until your accountant confirms the rate."
            >
              <NumberInput
                id="lb-tax"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Field name="dueDays">
          {(f) => (
            <FieldWrapper
              label="Payment due after (days)"
              htmlFor="lb-due"
              error={fieldError(f)}
              hint="0 = due on the day of issue."
            >
              <NumberInput
                id="lb-due"
                mode="integer"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
      </form>
    </FormSheet>
  )
}
