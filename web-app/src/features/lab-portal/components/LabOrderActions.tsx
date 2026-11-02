import { useState } from 'react'
import { todayYmd } from '@/lib/datetime'
import { CalendarClock, Check, HelpCircle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper } from '@/components/shared'
import { DatePicker } from '@/components/shared/DatePicker'
import { fieldError } from '@/features/queue'
import { useLabOrderActionForm } from '../hooks/useLabOrderActionForm'
import type { LabActionsApi, LabOrderAction } from '../types'

const COPY: Record<
  LabOrderAction,
  {
    label: string
    title: string
    description: string
    confirm: string
    icon: typeof Check
    variant: 'default' | 'outline' | 'destructive'
  }
> = {
  accept: {
    label: 'Accept',
    title: 'Accept this order',
    description:
      'Tell the clinic when the work will be ready. The doctor is notified.',
    confirm: 'Accept order',
    icon: Check,
    variant: 'default',
  },
  request_clarification: {
    label: 'Ask a question',
    title: 'Ask the clinic',
    description:
      'The order waits until the clinic answers. The doctor is notified.',
    confirm: 'Send question',
    icon: HelpCircle,
    variant: 'outline',
  },
  reject: {
    label: 'Reject',
    title: 'Reject this order',
    description: 'The clinic sees your reason and can send the case elsewhere.',
    confirm: 'Reject order',
    icon: X,
    variant: 'destructive',
  },
  change_expected_date: {
    label: 'Change date',
    title: 'Change the expected date',
    description: 'The doctor is told the new date and your reason.',
    confirm: 'Save new date',
    icon: CalendarClock,
    variant: 'outline',
  },
}

const ORDER: LabOrderAction[] = [
  'accept',
  'request_clarification',
  'change_expected_date',
  'reject',
]

/**
 * The lab's answers to an order as buttons + one dialog. Used by the lab
 * portal, the no-login magic-link page and the clinic's proxy panel — `api`
 * decides which route the answer takes; `actions` come from the server.
 */
export function LabOrderActions({
  actions,
  api,
  version,
  labExpectedOn,
  size,
}: {
  actions: LabOrderAction[]
  api: LabActionsApi
  version?: number
  labExpectedOn: string | null
  size?: 'sm' | 'default'
}) {
  const [open, setOpen] = useState<LabOrderAction | null>(null)
  const form = useLabOrderActionForm({
    action: open,
    api,
    version,
    labExpectedOn,
    onDone: () => setOpen(null),
  })
  const visible = ORDER.filter(
    (a) =>
      actions.includes(a) &&
      (a !== 'change_expected_date' || !!api.changeExpectedDate),
  )
  if (!visible.length) return null
  const copy = open ? COPY[open] : null
  const needsDate = open === 'accept' || open === 'change_expected_date'

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {visible.map((a) => {
          const Icon = COPY[a].icon
          return (
            <Button
              key={a}
              size={size}
              variant={COPY[a].variant}
              onClick={() => setOpen(a)}
            >
              <Icon className="size-4" /> {COPY[a].label}
            </Button>
          )
        })}
      </div>

      <Dialog
        open={!!open}
        onOpenChange={(o) => !o && !form.state.isSubmitting && setOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy?.title}</DialogTitle>
            <DialogDescription>{copy?.description}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void form.handleSubmit()
            }}
          >
            {needsDate && (
              <form.Field name="labExpectedOn">
                {(f) => (
                  <FieldWrapper
                    label="Ready on"
                    htmlFor="lab-expected-on"
                    required
                    error={fieldError(f)}
                  >
                    <DatePicker
                      id="lab-expected-on"
                      value={f.state.value || undefined}
                      min={todayYmd()}
                      onChange={(v) => {
                        f.handleChange(v)
                        f.handleBlur()
                      }}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            )}
            {open === 'accept' && (
              <form.Field name="note">
                {(f) => (
                  <FieldWrapper
                    label="Note for the clinic"
                    htmlFor="lab-accept-note"
                    error={fieldError(f)}
                  >
                    <Textarea
                      id="lab-accept-note"
                      rows={2}
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      onBlur={f.handleBlur}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            )}
            {(open === 'reject' || open === 'change_expected_date') && (
              <form.Field name="reason">
                {(f) => (
                  <FieldWrapper
                    label="Reason"
                    htmlFor="lab-action-reason"
                    required
                    error={fieldError(f)}
                  >
                    <Textarea
                      id="lab-action-reason"
                      rows={3}
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      onBlur={f.handleBlur}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            )}
            {open === 'request_clarification' && (
              <form.Field name="body">
                {(f) => (
                  <FieldWrapper
                    label="Question"
                    htmlFor="lab-question"
                    required
                    error={fieldError(f)}
                  >
                    <Textarea
                      id="lab-question"
                      rows={4}
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      onBlur={f.handleBlur}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(null)}
              >
                Back
              </Button>
              <form.Subscribe
                selector={(s) => [s.canSubmit, s.isSubmitting] as const}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    variant={
                      copy?.variant === 'destructive'
                        ? 'destructive'
                        : 'default'
                    }
                    disabled={!canSubmit || isSubmitting}
                  >
                    {isSubmitting && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {copy?.confirm}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
