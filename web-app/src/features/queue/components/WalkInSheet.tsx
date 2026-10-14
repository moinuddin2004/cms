import { useState } from 'react'
import { AlertTriangle, Loader2, Search, UserPlus, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/SearchableSelect'
import { FieldWrapper, FormSheet } from '@/components/shared'
import { useDoctors } from '@/features/appointments'
import { usePatientSearch } from '@/features/patients'
import { useWalkInForm } from '../hooks/useWalkInForm'
import type { WalkInNotice } from '../hooks/useWalkInForm'
import { fieldError } from '../utils/fieldError'

interface PickedPatient {
  id: string
  fullName: string
  phone: string
  patientNumber?: string
}

/**
 * Walk-in registration at the desk. The patient gets the next token in the
 * chosen doctor's queue; a ticket can be printed from the success toast.
 */
export function WalkInSheet({
  open,
  onOpenChange,
  defaultDoctorId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDoctorId?: string
}) {
  const { data: doctors = [] } = useDoctors()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<PickedPatient | null>(null)
  const { patients, isSearching, isActive } = usePatientSearch(query)

  const close = () => {
    setQuery('')
    setPicked(null)
    onOpenChange(false)
  }
  const { form, notice, clearNotice, isPending, addAnyway } = useWalkInForm({
    open,
    defaultDoctorId,
    onDone: close,
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => {
        if (!o && !isPending) close()
      }}
      title="Add walk-in"
      description="The patient gets the next token in the chosen doctor's queue."
      widthClassName="sm:max-w-md"
      footer={
        <WalkInFooter
          notice={notice}
          isPending={isPending}
          onCancel={close}
          onAddAnyway={() => void addAnyway()}
          submitButton={
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  form="walk-in-form"
                  disabled={
                    !canSubmit ||
                    isSubmitting ||
                    isPending ||
                    notice?.kind === 'same'
                  }
                >
                  {(isSubmitting || isPending) && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Add to queue
                </Button>
              )}
            </form.Subscribe>
          }
        />
      }
    >
      <form
        id="walk-in-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <form.Field name="mode">
          {(field) => (
            <div
              className="flex overflow-hidden rounded-lg border border-border text-xs"
              role="tablist"
            >
              {(
                [
                  { key: 'search', icon: Search, label: 'Existing patient' },
                  { key: 'new', icon: UserPlus, label: 'New patient' },
                ] as const
              ).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={field.state.value === key}
                  onClick={() => {
                    field.handleChange(key)
                    clearNotice()
                  }}
                  className={
                    field.state.value === key
                      ? 'flex-1 bg-primary px-3 py-2 font-medium text-primary-foreground'
                      : 'flex-1 bg-card px-3 py-2 text-muted-foreground hover:bg-accent'
                  }
                >
                  <Icon className="mr-1.5 inline size-3.5" />
                  {label}
                </button>
              ))}
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => s.values.mode}>
          {(mode) =>
            mode === 'search' ? (
              <form.Field name="patientId">
                {(field) => (
                  <FieldWrapper
                    label="Patient"
                    htmlFor="walkin-search"
                    required
                    error={fieldError(field)}
                  >
                    {picked ? (
                      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {picked.fullName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {picked.patientNumber ?? ''} · {picked.phone}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPicked(null)
                            field.handleChange('')
                            clearNotice()
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="walkin-search"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="Search by name or phone…"
                          className="h-9 pl-9"
                          autoComplete="off"
                          autoFocus
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
                                No patients found — use &quot;New patient&quot;.
                              </div>
                            )}
                            {patients.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setPicked({
                                    id: p.id,
                                    fullName: p.fullName,
                                    phone: p.phone,
                                    patientNumber: p.patientNumber,
                                  })
                                  field.handleChange(p.id)
                                  setQuery('')
                                  clearNotice()
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
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
                )}
              </form.Field>
            ) : (
              <div className="space-y-4">
                <form.Field name="patientName">
                  {(field) => (
                    <FieldWrapper
                      label="Patient name"
                      htmlFor="walkin-name"
                      required
                      error={fieldError(field)}
                    >
                      <Input
                        id="walkin-name"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Full name"
                        className="h-9"
                        autoFocus
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
                <form.Field name="patientPhone">
                  {(field) => (
                    <FieldWrapper
                      label="Phone"
                      htmlFor="walkin-phone"
                      required
                      error={fieldError(field)}
                    >
                      <Input
                        id="walkin-phone"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="03xx-xxxxxxx"
                        className="h-9"
                        inputMode="tel"
                      />
                    </FieldWrapper>
                  )}
                </form.Field>
              </div>
            )
          }
        </form.Subscribe>

        <form.Field name="doctorId">
          {(field) => (
            <FieldWrapper
              label="Doctor"
              required
              error={fieldError(field)}
              hint="Tokens belong to a doctor, so pick one."
            >
              <Select
                value={field.state.value}
                onValueChange={(v) => {
                  field.handleChange(v)
                  field.handleBlur()
                  clearNotice()
                }}
              >
                <SelectTrigger className="h-9" aria-label="Doctor">
                  <SelectValue placeholder="Choose the doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      Dr. {d.fullName}
                      {d.designation ? ` · ${d.designation}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>
          )}
        </form.Field>

        <form.Field name="reasonForVisit">
          {(field) => (
            <FieldWrapper
              label="Reason for visit"
              htmlFor="walkin-reason"
              error={fieldError(field)}
            >
              <Input
                id="walkin-reason"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="e.g. Fever, tooth pain…"
                className="h-9"
              />
            </FieldWrapper>
          )}
        </form.Field>

        <form.Field name="urgent">
          {(field) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id="walkin-urgent"
                checked={field.state.value}
                onCheckedChange={(v) => field.handleChange(v === true)}
              />
              <Label
                htmlFor="walkin-urgent"
                className="flex items-center gap-1 text-sm"
              >
                <Zap className="size-3.5 text-red-500" /> Urgent priority?
              </Label>
            </div>
          )}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.urgent}>
          {(urgent) =>
            urgent ? (
              <form.Field name="urgentReason">
                {(field) => (
                  <FieldWrapper
                    label="Urgent reason"
                    htmlFor="walkin-urgent-reason"
                    required
                    error={fieldError(field)}
                  >
                    <Input
                      id="walkin-urgent-reason"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="e.g. Severe bleeding"
                      className="h-9"
                    />
                  </FieldWrapper>
                )}
              </form.Field>
            ) : null
          }
        </form.Subscribe>

        {notice && <WalkInNoticeBox notice={notice} />}
      </form>
    </FormSheet>
  )
}

function WalkInNoticeBox({ notice }: { notice: WalkInNotice }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      {notice.kind === 'same' ? (
        <p>
          Already in this doctor&apos;s queue with token{' '}
          <strong className="text-sm">{notice.token}</strong>. Nothing was
          added.
        </p>
      ) : (
        <div>
          <p>{notice.message}:</p>
          <ul className="mt-1 list-disc pl-4">
            {notice.entries.map((e) => (
              <li key={e.token}>
                {e.token} · Dr. {e.doctorName ?? '—'}
              </li>
            ))}
          </ul>
          <p className="mt-1">Add to this doctor&apos;s queue as well?</p>
        </div>
      )}
    </div>
  )
}

function WalkInFooter({
  notice,
  isPending,
  onCancel,
  onAddAnyway,
  submitButton,
}: {
  notice: WalkInNotice | null
  isPending: boolean
  onCancel: () => void
  onAddAnyway: () => void
  submitButton: React.ReactNode
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isPending}
      >
        Close
      </Button>
      {notice?.kind === 'elsewhere' ? (
        <Button
          type="button"
          onClick={onAddAnyway}
          disabled={isPending}
          className="bg-amber-600 hover:bg-amber-700"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Add anyway
        </Button>
      ) : (
        submitButton
      )}
    </>
  )
}
