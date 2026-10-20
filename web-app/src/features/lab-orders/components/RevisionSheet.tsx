import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper, FormSection, FormSheet } from '@/components/shared'
import {
  answersToSend,
  DynamicFormFields,
  readFields,
} from '@/features/engine-studio'
import { fieldError } from '@/features/queue'
import { useOrderMutation } from '../hooks/useLabOrders'
import { orderError } from '../lib/order-errors'
import { revisionSchema } from '../schemas/lab-order.schema'
import { labOrdersApi } from '../services/lab-orders.api'
import type { LabOrderDetail, OrderIssue } from '../types'

/**
 * Change a submitted order's instructions. Never an overwrite: the server
 * keeps every revision, re-checks the answers against each line's pinned
 * form and asks the lab to acknowledge (lab ERD §13 "Revisions").
 */
export function RevisionSheet({
  open,
  onOpenChange,
  order,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: LabOrderDetail
}) {
  const lines = order.items.filter((i) => i.form && i.status !== 'cancelled')
  const [answers, setAnswers] = useState<
    Record<string, Record<string, unknown>>
  >({})
  const [issues, setIssues] = useState<OrderIssue[]>([])
  const revise = useOrderMutation(
    (reason: string) =>
      labOrdersApi.revise(order.id, {
        version: order.version,
        reason,
        items: lines
          .filter(
            (i) => JSON.stringify(answers[i.id]) !== JSON.stringify(i.answers),
          )
          .map((i) => ({
            itemId: i.id,
            answers: answersToSend(
              readFields(i.form!.schemaJson),
              answers[i.id] ?? {},
            ),
          })),
      }),
    {
      success: (o) => `Revision ${o.currentRevisionNo} sent to the lab`,
      silentError: true,
    },
  )
  const form = useForm({
    defaultValues: { reason: '' },
    validators: { onChange: revisionSchema, onSubmit: revisionSchema },
    onSubmit: async ({ value }) => {
      setIssues([])
      try {
        await revise.mutateAsync(value.reason.trim())
        onOpenChange(false)
      } catch (err) {
        const e = orderError(err)
        setIssues(
          e.issues.length
            ? e.issues
            : [{ line: null, path: '', code: 'error', message: e.message }],
        )
      }
    },
  })
  useEffect(() => {
    if (open) {
      setAnswers(Object.fromEntries(order.items.map((i) => [i.id, i.answers])))
      setIssues([])
      form.reset({ reason: '' })
    }
  }, [open, order, form])

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={`Revise ${order.orderNo ?? 'order'}`}
      description="The lab gets the new version and acknowledges it. Prices stay as agreed at submit unless the work changes."
      widthClassName="sm:max-w-3xl"
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
                disabled={!canSubmit || isSubmitting}
                onClick={() => void form.handleSubmit()}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                Send revision
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <form.Field name="reason">
          {(f) => (
            <FieldWrapper
              label="What changed"
              htmlFor="rev-reason"
              required
              error={fieldError(f)}
            >
              <Textarea
                id="rev-reason"
                rows={2}
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        {issues
          .filter((i) => i.line === null)
          .map((i, n) => (
            <p key={n} className="text-sm text-destructive">
              {i.message}
            </p>
          ))}
        {lines.map((i) => (
          <FormSection
            key={i.id}
            title={`${i.lineNo}. ${i.serviceName ?? 'Item'}`}
          >
            <div className="space-y-4">
              <DynamicFormFields
                fields={readFields(i.form!.schemaJson)}
                ui={i.form!.uiJson}
                answers={answers[i.id] ?? {}}
                onChange={(key, v) =>
                  setAnswers((a) => ({
                    ...a,
                    [i.id]: { ...(a[i.id] ?? {}), [key]: v },
                  }))
                }
                errorFor={(key) =>
                  issues.find((x) => x.line === i.lineNo && x.path === key)
                    ?.message
                }
              />
            </div>
          </FormSection>
        ))}
      </form>
    </FormSheet>
  )
}
