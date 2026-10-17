import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2, Lock, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionCard } from '../shared/billing-ui'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { ErrorState, LoadingSkeleton } from '@/components/shared'
import { fieldError } from '@/features/queue/utils/fieldError'
import { useBillingMutation } from '../../hooks/use-billing-mutation'
import {
  useBillingSettings,
  useCatalogServices,
  usePaymentAccounts,
} from '../../hooks/use-billing-queries'
import { billingSettingsSchema, toAmount } from '../../schemas/billing.schema'
import type { BillingSettingsValues } from '../../schemas/billing.schema'
import { configApi } from '../../services/billing-v2.api'
import type { BillingSettings } from '../../types/billing.types'
import { OptionSelect } from '../shared/OptionSelect'

const NONE = 'NONE'
const FORMATS = [
  { value: 'A4', label: 'A4' },
  { value: 'THERMAL_80', label: 'Thermal 80 mm' },
]

const EMPTY: BillingSettingsValues = {
  documentCode: '',
  dueDays: 7,
  invoicePrintFormat: 'A4',
  receiptPrintFormat: 'A4',
  showLogo: true,
  showPreviousBalance: true,
  showOutstandingAtCheckIn: true,
  footerNote: '',
  defaultConsultationServiceId: NONE,
  defaultPaymentAccountId: '',
  cashVarianceAlertAmount: '0',
}

const toValues = (s: BillingSettings): BillingSettingsValues => ({
  documentCode: s.documentCode ?? '',
  dueDays: s.dueDays,
  invoicePrintFormat: s.invoicePrintFormat,
  receiptPrintFormat: s.receiptPrintFormat,
  showLogo: s.showLogo,
  showPreviousBalance: s.showPreviousBalance,
  showOutstandingAtCheckIn: s.showOutstandingAtCheckIn,
  footerNote: s.footerNote ?? '',
  defaultConsultationServiceId: s.defaultConsultationServiceId ?? NONE,
  defaultPaymentAccountId: s.defaultPaymentAccountId ?? '',
  cashVarianceAlertAmount: String(s.cashVarianceAlertAmount),
})

/** Payments and printing settings of the active location (5.4). Admin only. */
export function BillingSettingsForm() {
  const settings = useBillingSettings()
  const services = useCatalogServices({ activeOnly: true })
  const accounts = usePaymentAccounts(true)
  const save = useBillingMutation(
    (v: BillingSettingsValues) =>
      configApi.updateSettings({
        ...(settings.data?.documentCodeLocked
          ? {}
          : { documentCode: v.documentCode }),
        dueDays: v.dueDays,
        invoicePrintFormat: v.invoicePrintFormat,
        receiptPrintFormat: v.receiptPrintFormat,
        showLogo: v.showLogo,
        showPreviousBalance: v.showPreviousBalance,
        showOutstandingAtCheckIn: v.showOutstandingAtCheckIn,
        footerNote: v.footerNote.trim() || null,
        defaultConsultationServiceId:
          v.defaultConsultationServiceId === NONE
            ? null
            : v.defaultConsultationServiceId,
        defaultPaymentAccountId: v.defaultPaymentAccountId,
        cashVarianceAlertAmount: toAmount(v.cashVarianceAlertAmount),
      }),
    { success: 'Billing settings saved' },
  )
  const form = useForm({
    defaultValues: settings.data ? toValues(settings.data) : EMPTY,
    validators: {
      onChange: billingSettingsSchema,
      onSubmit: billingSettingsSchema,
    },
    onSubmit: ({ value }) => save.mutateAsync(value),
  })
  useEffect(() => {
    if (settings.data) form.reset(toValues(settings.data))
  }, [settings.data, form])

  if (settings.isLoading) return <LoadingSkeleton variant="detail" />
  if (settings.isError || !settings.data)
    return <ErrorState onRetry={() => void settings.refetch()} />
  const locked = settings.data.documentCodeLocked

  const toggle = (
    name: 'showLogo' | 'showPreviousBalance' | 'showOutstandingAtCheckIn',
    label: string,
    hint: string,
  ) => (
    <form.Field name={name}>
      {(f) => (
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="font-medium">{label}</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </span>
          <Switch
            checked={f.state.value}
            onCheckedChange={f.handleChange}
            aria-label={label}
          />
        </label>
      )}
    </form.Field>
  )

  return (
    <SectionCard
      icon={Settings2}
      title="Payments and printing"
      description={`Numbering, due dates and print layout for ${settings.data.locationName}`}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <form.Field name="documentCode">
            {(f) => (
              <FieldWrapper
                label="Document code"
                htmlFor="doc-code"
                required
                error={fieldError(f)}
                hint={
                  locked
                    ? 'Locked — numbers were already issued with it.'
                    : `Numbers look like ${f.state.value || 'KHI'}-INV-2026-00001`
                }
              >
                <div className="relative">
                  <Input
                    id="doc-code"
                    disabled={locked}
                    value={f.state.value}
                    onChange={(e) =>
                      f.handleChange(e.target.value.toUpperCase())
                    }
                    onBlur={f.handleBlur}
                  />
                  {locked && (
                    <Lock
                      className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-label="Locked"
                    />
                  )}
                </div>
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="dueDays">
            {(f) => (
              <FieldWrapper
                label="Invoice due after (days)"
                htmlFor="due-days"
                error={fieldError(f)}
              >
                <Input
                  id="due-days"
                  type="number"
                  min={0}
                  max={365}
                  value={f.state.value}
                  onChange={(e) => f.handleChange(Number(e.target.value))}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="invoicePrintFormat">
            {(f) => (
              <FieldWrapper label="Invoice print format">
                <OptionSelect
                  options={FORMATS}
                  value={f.state.value}
                  onChange={(v) =>
                    f.handleChange(
                      v as BillingSettingsValues['invoicePrintFormat'],
                    )
                  }
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="receiptPrintFormat">
            {(f) => (
              <FieldWrapper label="Receipt print format">
                <OptionSelect
                  options={FORMATS}
                  value={f.state.value}
                  onChange={(v) =>
                    f.handleChange(
                      v as BillingSettingsValues['receiptPrintFormat'],
                    )
                  }
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="defaultConsultationServiceId">
            {(f) => (
              <FieldWrapper
                label="Consultation fee service"
                hint="Charged automatically when a doctor completes a consultation."
              >
                <OptionSelect
                  options={[
                    { value: NONE, label: 'None (price at billing)' },
                    ...(services.data ?? [])
                      .filter((s) => s.kind === 'CONSULTATION')
                      .map((s) => ({ value: s.id, label: s.name })),
                  ]}
                  value={f.state.value}
                  onChange={f.handleChange}
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="defaultPaymentAccountId">
            {(f) => (
              <FieldWrapper label="Default payment account">
                <OptionSelect
                  options={(accounts.data ?? []).map((a) => ({
                    value: a.id,
                    label: a.name,
                  }))}
                  value={f.state.value}
                  onChange={f.handleChange}
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="cashVarianceAlertAmount">
            {(f) => (
              <FieldWrapper
                label="Flag cash closes with a difference above (Rs)"
                htmlFor="variance-alert"
                error={fieldError(f)}
              >
                <Input
                  id="variance-alert"
                  inputMode="decimal"
                  className="tabular-nums"
                  value={f.state.value}
                  onChange={(e) => f.handleChange(e.target.value)}
                  onBlur={f.handleBlur}
                />
              </FieldWrapper>
            )}
          </form.Field>
        </div>
        <form.Field name="footerNote">
          {(f) => (
            <FieldWrapper
              label="Footer note (printed)"
              htmlFor="footer-note"
              error={fieldError(f)}
            >
              <Textarea
                id="footer-note"
                dir="auto"
                rows={2}
                maxLength={300}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <div className="space-y-3 rounded-lg border border-border bg-panel p-3">
          {toggle(
            'showLogo',
            'Print logo',
            'Uses the location logo from location settings.',
          )}
          {toggle(
            'showPreviousBalance',
            'Print previous balance',
            "Shows the patient's other dues on invoices.",
          )}
          {toggle(
            'showOutstandingAtCheckIn',
            'Show dues at check-in',
            'Reception sees a badge on queue rows. Doctors never do.',
          )}
        </div>
        <div className="flex justify-end">
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting, s.isDirty] as const}
          >
            {([canSubmit, isSubmitting, isDirty]) => (
              <Button
                onClick={() => void form.handleSubmit()}
                disabled={!canSubmit || isSubmitting || !isDirty}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}{' '}
                Save settings
              </Button>
            )}
          </form.Subscribe>
        </div>
      </div>
    </SectionCard>
  )
}
