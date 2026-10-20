import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  AlertTriangle,
  Loader2,
  Plus,
  Repeat,
  Search,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  FieldWrapper,
  FormSection,
  FormSelect,
  FormSheet,
} from '@/components/shared'
import { DatePicker } from '@/components/shared/DatePicker'
import { useDoctors } from '@/features/appointments'
import {
  clinicCatalogApi,
  formatPaisa,
  useClinicForms,
  useClinicServices,
  useOrderTemplates,
} from '@/features/lab-catalog'
import { usePatientSearch } from '@/features/patients'
import { fieldError } from '@/features/queue'
import { emptyOrderItem, useLabOrderForm } from '../hooks/useLabOrderForm'
import { useOrderMutation } from '../hooks/useLabOrders'
import { labOrdersApi } from '../services/lab-orders.api'
import type { OrderItemFormValues } from '../schemas/lab-order.schema'
import type { LabOrderDetail } from '../types'
import { OrderItemEditor } from './OrderItemEditor'
import type { LineForm } from './OrderItemEditor'

const STEPS = ['Patient & lab', 'Items', 'Prices & send'] as const

/**
 * Create or edit a draft lab order (lab ERD §14.2) as a 3-step sheet:
 * patient, lab and doctor (or start from a template / the patient's last
 * order) → items with the service's form and tooth chart → both prices
 * per line, then save the draft or submit it.
 */
export function LabOrderSheet({
  open,
  onOpenChange,
  order: initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: LabOrderDetail | null
  onSaved?: (order: LabOrderDetail) => void
}) {
  const [step, setStep] = useState(0)
  const [order, setOrder] = useState<LabOrderDetail | null>(initial)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setOrder(initial)
      setStep(initial ? 1 : 0)
    }
  }

  const services = useClinicServices({ page: 1, limit: 100 }, open)
  const forms = useClinicForms(open)
  const { data: doctors = [] } = useDoctors()
  const rows = (services.data?.data ?? []).filter(
    (s) => s.linkStatus === 'active' && s.isActive,
  )
  const labs = useMemo(() => {
    const seen = new Map<string, string>()
    for (const s of services.data?.data ?? []) {
      if (s.linkStatus === 'active') seen.set(s.lab.id, s.lab.name)
    }
    return [...seen].map(([value, label]) => ({ value, label }))
  }, [services.data])

  /** The form a line renders: its pinned version, else the current one. */
  const lineForm = (item: OrderItemFormValues): LineForm | null => {
    const pinned = order?.items.find((i) => i.id && i.id === item.id)
    if (pinned && pinned.labServiceId === item.labServiceId) {
      return pinned.form
        ? { schemaJson: pinned.form.schemaJson, uiJson: pinned.form.uiJson }
        : null
    }
    const code = rows.find((s) => s.id === item.labServiceId)?.formSchema?.code
    const f = (forms.data ?? []).find((x) => x.code === code)
    return f
      ? { schemaJson: f.schemaJson, uiJson: (f as { uiJson?: unknown }).uiJson }
      : null
  }

  const { form, issues, run } = useLabOrderForm({
    open,
    order,
    formFor: (labServiceId) => {
      const item = form.state.values.items.find(
        (i) => i.labServiceId === labServiceId,
      )
      return item ? lineForm(item)?.schemaJson : null
    },
    onDone: (saved) => {
      onSaved?.(saved)
      if (saved.status !== 'draft') onOpenChange(false)
      else setOrder(saved)
    },
  })

  const close = () => !form.state.isSubmitting && onOpenChange(false)
  const lineIssues = (i: number) => issues.filter((x) => x.line === i + 1)
  const headerIssues = issues.filter((x) => x.line === null)

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title={
        order
          ? `Edit draft${order.orderNo ? ` ${order.orderNo}` : ''}`
          : 'New lab order'
      }
      description={`Step ${step + 1} of 3 — ${STEPS[step]}`}
      widthClassName="sm:max-w-3xl"
      footer={
        <form.Subscribe selector={(s) => [s.isSubmitting, s.values] as const}>
          {([isSubmitting, values]) => (
            <>
              <Button
                variant="outline"
                onClick={() => (step ? setStep(step - 1) : close())}
              >
                {step ? 'Back' : 'Cancel'}
              </Button>
              {step < 2 ? (
                <Button
                  disabled={
                    (step === 0 && (!values.patientId || !values.labId)) ||
                    (step === 1 && values.items.some((i) => !i.labServiceId))
                  }
                  onClick={() => setStep(step + 1)}
                >
                  Next
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => run('draft')}
                  >
                    {isSubmitting && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    Save draft
                  </Button>
                  <Button disabled={isSubmitting} onClick={() => run('submit')}>
                    {isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Submit to lab
                  </Button>
                </>
              )}
            </>
          )}
        </form.Subscribe>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          run('draft')
        }}
      >
        {headerIssues.length > 0 && (
          <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {headerIssues.map((i, n) => (
              <p key={n}>{i.message}</p>
            ))}
          </div>
        )}
        {issues.some((i) => i.line !== null) && step !== 1 && (
          <p className="text-sm text-destructive">
            Some items need attention —{' '}
            <button
              type="button"
              className="underline"
              onClick={() => setStep(1)}
            >
              review the items
            </button>
            .
          </p>
        )}

        {step === 0 && (
          <FormSection title="Patient & lab">
            <div className="space-y-4">
              <form.Field name="patientId">
                {(f) => (
                  <PatientField
                    disabled={!!order}
                    initial={order?.patient ?? null}
                    error={fieldError(f)}
                    onPick={(id) => f.handleChange(id)}
                  />
                )}
              </form.Field>
              <form.Field name="labId">
                {(f) => (
                  <FormSelect
                    label="Lab"
                    required
                    value={f.state.value}
                    disabled={!!order}
                    onValueChange={(v) => {
                      f.handleChange(v)
                      form.setFieldValue('items', [emptyOrderItem()])
                    }}
                    options={labs}
                    placeholder={
                      services.isLoading
                        ? 'Loading labs…'
                        : 'Choose an active lab'
                    }
                    error={fieldError(f)}
                    hint={
                      labs.length ? undefined : 'Activate a lab in Labs first.'
                    }
                  />
                )}
              </form.Field>
              <form.Field name="doctorId">
                {(f) => (
                  <FormSelect
                    label="Ordering doctor"
                    value={f.state.value}
                    onValueChange={f.handleChange}
                    options={doctors.map((d) => ({
                      value: d.id,
                      label: d.fullName,
                    }))}
                    placeholder="You (if you are a doctor)"
                  />
                )}
              </form.Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="priority">
                  {(f) => (
                    <FormSelect
                      label="Priority"
                      value={f.state.value}
                      onValueChange={(v) =>
                        f.handleChange(v as 'normal' | 'urgent')
                      }
                      options={[
                        { value: 'normal', label: 'Normal' },
                        { value: 'urgent', label: 'Urgent' },
                      ]}
                    />
                  )}
                </form.Field>
                <form.Field name="requestedOn">
                  {(f) => (
                    <FieldWrapper
                      label="Needed back by"
                      htmlFor="lo-requested"
                      error={fieldError(f)}
                    >
                      <DatePicker
                        id="lo-requested"
                        value={f.state.value || undefined}
                        onChange={f.handleChange}
                        clearable
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
              </div>
              <form.Field name="notes">
                {(f) => (
                  <FieldWrapper
                    label="Instructions for the lab"
                    htmlFor="lo-notes"
                    error={fieldError(f)}
                  >
                    <Textarea
                      id="lo-notes"
                      rows={2}
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      onBlur={f.handleBlur}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
              {!order && (
                <form.Subscribe selector={(s) => s.values.patientId}>
                  {(patientId) => (
                    <QuickStart
                      patientId={patientId}
                      onDraft={(draft) => {
                        setOrder(draft)
                        setStep(1)
                      }}
                    />
                  )}
                </form.Subscribe>
              )}
            </div>
          </FormSection>
        )}

        {step === 1 && (
          <form.Field name="items" mode="array">
            {(items) => {
              const labId = form.state.values.labId
              const labServices = rows.filter((s) => s.lab.id === labId)
              return (
                <FormSection title="Items">
                  <div className="space-y-4">
                    {items.state.value.map((item, i) => (
                      <OrderItemEditor
                        key={i}
                        index={i}
                        value={item}
                        onChange={(next) => items.replaceValue(i, next)}
                        onRemove={
                          items.state.value.length > 1
                            ? () => items.removeValue(i)
                            : undefined
                        }
                        services={labServices}
                        form={lineForm(item)}
                        orderId={order?.id ?? null}
                        issues={lineIssues(i)}
                      />
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={items.state.value.length >= 20}
                      onClick={() => items.pushValue(emptyOrderItem())}
                    >
                      <Plus className="size-3.5" /> Add item
                    </Button>
                  </div>
                </FormSection>
              )
            }}
          </form.Field>
        )}

        {step === 2 && (
          <form.Subscribe selector={(s) => s.values.items}>
            {(items) => <PriceReview items={items} order={order} />}
          </form.Subscribe>
        )}
      </form>
    </FormSheet>
  )
}

function PatientField({
  disabled,
  initial,
  error,
  onPick,
}: {
  disabled: boolean
  initial: { fullName: string; patientNumber: string } | null
  error?: string
  onPick: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState(initial)
  const { patients, isSearching, isActive } = usePatientSearch(query)
  return (
    <FieldWrapper label="Patient" htmlFor="lo-patient" required error={error}>
      {picked ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <div>
            <p className="text-sm font-semibold">{picked.fullName}</p>
            <p className="text-xs text-muted-foreground">
              {picked.patientNumber}
            </p>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setPicked(null)
                onPick('')
              }}
            >
              Change
            </Button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="lo-patient"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, number or phone…"
            className="h-9 pl-9"
            autoComplete="off"
          />
          {isActive && (
            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
              {isSearching && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Searching…
                </div>
              )}
              {!isSearching && patients.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No patients found.
                </div>
              )}
              {patients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    setPicked({
                      fullName: p.fullName,
                      patientNumber: p.patientNumber,
                    })
                    onPick(p.id)
                    setQuery('')
                  }}
                >
                  <p className="font-medium">{p.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.patientNumber} · {p.phone}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </FieldWrapper>
  )
}

/** "Doctor speed" (lab ERD §13): a template or the patient's last order. */
function QuickStart({
  patientId,
  onDraft,
}: {
  patientId: string
  onDraft: (draft: LabOrderDetail) => void
}) {
  const templates = useOrderTemplates({ page: 1, limit: 50, scope: 'all' })
  const [templateId, setTemplateId] = useState('')
  const fromTemplate = useOrderMutation(
    () => labOrdersApi.fromTemplate(templateId, patientId),
    { success: 'Draft started from the template' },
  )
  const repeat = useOrderMutation(
    async () => {
      const last = await labOrdersApi.list({
        page: 1,
        limit: 1,
        patientId,
        submittedOnly: true,
      })
      const prev = last.data.at(0)
      if (!prev) throw new Error('This patient has no earlier lab order')
      return labOrdersApi.repeat(prev.id)
    },
    { success: (o) => `Copied into a new draft for ${o.patient.fullName}` },
  )
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-3">
        Quick start
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <FormSelect
          label="From a template"
          value={templateId}
          onValueChange={setTemplateId}
          options={(templates.data?.data ?? [])
            .filter((t) => t.isActive && t.lab)
            .map((t) => ({
              value: t.id,
              label: `${t.name} · ${t.lab?.name ?? ''}`,
            }))}
          placeholder="Choose a template"
          containerClassName="min-w-56 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          disabled={!patientId || !templateId || fromTemplate.isPending}
          onClick={() => fromTemplate.mutate(undefined, { onSuccess: onDraft })}
        >
          {fromTemplate.isPending && (
            <Loader2 className="size-4 animate-spin" />
          )}
          Use template
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!patientId || repeat.isPending}
          onClick={() => repeat.mutate(undefined, { onSuccess: onDraft })}
        >
          {repeat.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Repeat className="size-4" />
          )}
          Repeat last order
        </Button>
      </div>
      {!patientId && (
        <p className="text-xs text-text-3">Pick the patient first.</p>
      )}
    </div>
  )
}

/** Both prices per line, as submit will snapshot them (lab ERD §14.2.4). */
function PriceReview({
  items,
  order,
}: {
  items: OrderItemFormValues[]
  order: LabOrderDetail | null
}) {
  const quotes = useQueries({
    queries: items.map((i) => ({
      queryKey: [
        'lab-orders',
        'quote',
        i.labServiceId,
        i.optionIds.join(','),
        i.rush,
      ],
      queryFn: () =>
        clinicCatalogApi.quote({
          labServiceId: i.labServiceId,
          optionIds: i.optionIds.join(',') || undefined,
          rush: i.rush,
        }),
      enabled: !!i.labServiceId,
    })),
  })
  const qty = (i: OrderItemFormValues, unitType?: string) => {
    if (unitType === 'per_tooth') {
      const teeth = i.answers.teeth
      return Array.isArray(teeth) && teeth.length ? teeth.length : 1
    }
    return Number(i.quantity) || 1
  }
  let lab = 0
  let patient = 0
  return (
    <FormSection title="Prices">
      <div className="space-y-3">
        {items.map((i, n) => {
          const q = quotes[n]
          if (q.isLoading) {
            return (
              <p key={n} className="text-sm text-text-3">
                Pricing item {n + 1}…
              </p>
            )
          }
          if (q.isError || !q.data) {
            return (
              <p
                key={n}
                className="flex items-center gap-2 text-sm text-destructive"
              >
                <AlertTriangle className="size-4" /> Item {n + 1}: no price
                available today.
              </p>
            )
          }
          const units = qty(i, q.data.labService.unitType)
          const labLine = q.data.lab.unitPaisa * units
          const patientLine = (q.data.patient?.unitPricePaisa ?? 0) * units
          lab += labLine
          patient += patientLine
          return (
            <div
              key={n}
              className="flex items-start justify-between gap-4 rounded-lg border border-border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{q.data.labService.name}</p>
                <p className="text-xs text-text-3">
                  {units} × {formatPaisa(q.data.lab.unitPaisa)} lab cost
                </p>
                {!q.data.patient && (
                  <p className="text-xs text-destructive">
                    Not mapped to a treatment — map it in the lab price list
                    before submitting.
                  </p>
                )}
              </div>
              <div className="text-right tabular-nums">
                <p>{formatPaisa(labLine)}</p>
                <p className="text-xs text-text-3">
                  Patient {formatPaisa(patientLine)}
                </p>
              </div>
            </div>
          )
        })}
        <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold tabular-nums">
          <span>Total</span>
          <span>
            Lab {formatPaisa(lab)} · Patient {formatPaisa(patient)}
          </span>
        </div>
        {order?.warnings.map((w) => (
          <p
            key={w.code}
            className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <AlertTriangle className="size-4 shrink-0" /> {w.message}
          </p>
        ))}
        <p className="text-xs text-text-3">
          Prices are fixed when you submit; later catalog changes don’t affect
          this order.
        </p>
      </div>
    </FormSection>
  )
}
