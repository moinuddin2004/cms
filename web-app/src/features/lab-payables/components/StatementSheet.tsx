import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  FieldWrapper,
  FormInput,
  FormSelect,
  FormSheet,
} from '@/components/shared'
import { DatePicker } from '@/components/shared/DatePicker'
import { formatPaisa } from '@/features/lab-catalog'
import { fieldError } from '@/features/queue'
import { useStatementForm } from '../hooks/usePayablesForms'
import { parseStatementLines } from '../schemas/lab-payables.schema'
import type { StatementValues } from '../schemas/lab-payables.schema'

/**
 * Enter a lab's monthly statement (lab ERD §6b): the lines are matched to
 * the period's bills by order / bill / lab invoice no. and amount as soon as
 * it is saved.
 */
export function StatementSheet({
  open,
  labs,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  labs: Array<[string, string]>
  onOpenChange: (open: boolean) => void
  onSubmit: (v: StatementValues) => Promise<unknown>
}) {
  const form = useStatementForm({
    open,
    onSubmit: async (v) => {
      await onSubmit(v)
      onOpenChange(false)
    },
  })
  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title="Add lab statement"
      description="Type or paste the lab's lines. Each line is checked against your bills for the period."
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
                Save and reconcile
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
        <form.Field name="labId">
          {(f) => (
            <FormSelect
              label="Lab"
              required
              placeholder="Choose the lab"
              value={f.state.value}
              onValueChange={f.handleChange}
              options={labs.map(([value, label]) => ({ value, label }))}
              error={fieldError(f)}
            />
          )}
        </form.Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="periodStart">
            {(f) => (
              <FieldWrapper label="From" required error={fieldError(f)}>
                <DatePicker
                  value={f.state.value || undefined}
                  onChange={f.handleChange}
                />
              </FieldWrapper>
            )}
          </form.Field>
          <form.Field name="periodEnd">
            {(f) => (
              <FieldWrapper label="To" required error={fieldError(f)}>
                <DatePicker
                  value={f.state.value || undefined}
                  onChange={f.handleChange}
                />
              </FieldWrapper>
            )}
          </form.Field>
        </div>
        <form.Field name="statementRef">
          {(f) => (
            <FormInput
              label="Statement ref."
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
              error={fieldError(f)}
            />
          )}
        </form.Field>
        <form.Field name="lines">
          {(f) => (
            <FieldWrapper
              label="Lines"
              htmlFor="statement-lines"
              required
              error={fieldError(f)}
              hint="One per line: reference, amount — e.g. LAB-0012, 5000 (optional: , 2026-10-04, description). Pasted spreadsheet columns work too."
            >
              <Textarea
                id="statement-lines"
                rows={8}
                className="font-mono text-xs"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
                onBlur={f.handleBlur}
              />
            </FieldWrapper>
          )}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.lines}>
          {(raw) => {
            const { lines } = parseStatementLines(raw)
            const total = lines.reduce((a, l) => a + l.amountPaisa, 0)
            return (
              <p className="text-sm text-text-3">
                {lines.length} line{lines.length === 1 ? '' : 's'} ·{' '}
                {formatPaisa(total)}
              </p>
            )
          }}
        </form.Subscribe>
      </form>
    </FormSheet>
  )
}
