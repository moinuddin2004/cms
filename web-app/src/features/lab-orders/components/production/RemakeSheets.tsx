import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper, FormSelect, FormSheet } from '@/components/shared'
import { formatMinor } from '@/features/lab-catalog'
import { fieldError } from '@/features/queue'
import {
  useRemakeDecisionForm,
  useRemakeRequestForm,
} from '../../hooks/useProduction'
import { REMAKE_REASON_LABEL, RESPONSIBLE_LABEL } from '../../production.types'
import type {
  ProductionItem,
  RemakeReason,
  RemakeRequest,
  ResponsibleParty,
} from '../../production.types'
import type {
  RemakeDecisionValues,
  RemakeRequestValues,
} from '../../schemas/production.schema'

const REASONS = (Object.keys(REMAKE_REASON_LABEL) as RemakeReason[]).map(
  (value) => ({ value, label: REMAKE_REASON_LABEL[value] }),
)
const PARTIES = (Object.keys(RESPONSIBLE_LABEL) as ResponsibleParty[]).map(
  (value) => ({ value, label: RESPONSIBLE_LABEL[value] }),
)

/**
 * Ask for a remake: `reject` = received final work fails review (the item
 * goes to remake); `aftercare` = delivered work failed later (warranty
 * checked automatically).
 */
export function RemakeRequestSheet({
  item,
  mode,
  onOpenChange,
  onSubmit,
}: {
  item: ProductionItem | null
  mode: 'reject' | 'aftercare'
  onOpenChange: (open: boolean) => void
  onSubmit: (v: RemakeRequestValues) => Promise<unknown>
}) {
  const form = useRemakeRequestForm({
    open: !!item,
    onSubmit: async (v) => {
      await onSubmit(v)
      onOpenChange(false)
    },
  })
  const reject = mode === 'reject'
  return (
    <FormSheet
      open={!!item}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={reject ? 'Reject work — request a remake' : 'Request a remake'}
      description={
        reject
          ? `${item?.serviceName ?? ''}: the lab is told, and a new item is made once you agree who is responsible.`
          : `${item?.serviceName ?? ''} was delivered. An active warranty makes this a warranty claim.`
      }
      widthClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) => [s.canSubmit, s.isSubmitting] as const}
          >
            {([canSubmit, isSubmitting]) => (
              <Button
                variant={reject ? 'destructive' : 'default'}
                disabled={!canSubmit || isSubmitting}
                onClick={() => void form.handleSubmit()}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {reject ? 'Reject work' : 'Request remake'}
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
        <form.Field name="reasonCode">
          {(f) => (
            <FormSelect
              label="Reason"
              required
              value={f.state.value}
              onValueChange={(v) => f.handleChange(v as RemakeReason)}
              options={REASONS}
            />
          )}
        </form.Field>
        <form.Field name="notes">
          {(f) => (
            <FieldWrapper
              label="What is wrong"
              htmlFor="remake-notes"
              required
              error={fieldError(f)}
            >
              <Textarea
                id="remake-notes"
                rows={4}
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

/** Charges a decision would give, mirroring the server's rule. */
function preview(
  party: ResponsibleParty,
  item: ProductionItem | undefined,
  prices: { lab: number; patient: number } | null,
) {
  if (!prices || !item || party === 'undetermined') return null
  if (party === 'lab')
    return 'The lab remakes it free; the patient pays nothing.'
  if (party === 'clinic') {
    return `The clinic pays the lab ${formatMinor(prices.lab)}; the patient pays nothing.`
  }
  return `Charged again: lab ${formatMinor(prices.lab)}, patient ${formatMinor(prices.patient)}.`
}

/** Agree a remake (who is responsible sets the prices) or close it. */
export function RemakeDecisionSheet({
  remake,
  item,
  prices,
  onOpenChange,
  onSubmit,
}: {
  remake: RemakeRequest | null
  item?: ProductionItem
  /** The original line's prices (from the order). */
  prices: { lab: number; patient: number } | null
  onOpenChange: (open: boolean) => void
  onSubmit: (v: RemakeDecisionValues) => Promise<unknown>
}) {
  const form = useRemakeDecisionForm({
    remake,
    onSubmit: async (v) => {
      await onSubmit(v)
      onOpenChange(false)
    },
  })
  return (
    <FormSheet
      open={!!remake}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Remake decision"
      description={
        remake
          ? `${remake.serviceName ?? ''} — ${REMAKE_REASON_LABEL[remake.reasonCode]}${remake.isWarrantyClaim ? ' · warranty claim' : ''}`
          : undefined
      }
      widthClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <form.Subscribe
            selector={(s) =>
              [s.canSubmit, s.isSubmitting, s.values.decision] as const
            }
          >
            {([canSubmit, isSubmitting, decision]) => (
              <Button
                disabled={!canSubmit || isSubmitting}
                onClick={() => void form.handleSubmit()}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {decision === 'agree' ? 'Agree remake' : 'Close request'}
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
        {remake?.notes && (
          <p className="text-sm text-text-2">Clinic notes: {remake.notes}</p>
        )}
        {remake?.disputeNote && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Lab disputes: {remake.disputeNote}
          </p>
        )}
        <form.Field name="decision">
          {(f) => (
            <FormSelect
              label="Decision"
              required
              value={f.state.value}
              onValueChange={(v) => f.handleChange(v as 'agree' | 'close')}
              options={[
                { value: 'agree', label: 'Agree — make it again' },
                { value: 'close', label: 'Close — no remake' },
              ]}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.decision}>
          {(decision) =>
            decision === 'agree' && (
              <form.Field name="responsibleParty">
                {(f) => (
                  <FormSelect
                    label="Who is responsible"
                    required
                    value={f.state.value}
                    onValueChange={(v) => f.handleChange(v as ResponsibleParty)}
                    options={PARTIES}
                    error={fieldError(f)}
                    hint={preview(f.state.value, item, prices)}
                  />
                )}
              </form.Field>
            )
          }
        </form.Subscribe>
        <form.Field name="note">
          {(f) => (
            <FieldWrapper
              label="Note"
              htmlFor="remake-decision-note"
              error={fieldError(f)}
            >
              <Textarea
                id="remake-decision-note"
                rows={3}
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
