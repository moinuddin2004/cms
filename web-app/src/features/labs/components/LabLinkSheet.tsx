import { useState } from 'react'
import { Check, FlaskConical, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NumberInput } from '@/components/forms/NumberInput'
import {
  EmptyState,
  ErrorState,
  FieldWrapper,
  FormSection,
  FormSelect,
  FormSheet,
} from '@/components/shared'
import { Skeleton } from '@/components/ui/skeleton'
import { fieldError } from '@/features/queue'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { useAvailableLabs } from '../hooks/useLabLinks'
import { useLabLinkForm } from '../hooks/useLabLinkForm'
import { PATIENT_DATA_LABEL } from '../types'
import type { DirectoryLab, LabLink, PatientDataLevel } from '../types'
import { LabTypeBadge, LinkStatusBadge } from './lab-badges'

const DATA_OPTIONS = (
  Object.keys(PATIENT_DATA_LABEL) as PatientDataLevel[]
).map((v) => ({ value: v, label: PATIENT_DATA_LABEL[v] }))

/**
 * Add a lab to the clinic's list — pick it from the platform directory, set
 * payment terms and how much patient identity the lab sees — or edit the
 * terms of a lab already on the list.
 */
export function LabLinkSheet({
  open,
  onOpenChange,
  link,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  link: LabLink | null
}) {
  const { form, isEditing } = useLabLinkForm({
    open,
    link,
    onDone: () => onOpenChange(false),
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => !form.state.isSubmitting && onOpenChange(o)}
      title={isEditing ? `Terms with ${link?.lab.name}` : 'Add a lab'}
      description={
        isEditing
          ? 'Applies to new orders. Orders already sent keep their terms.'
          : 'Choose a lab from the directory. It stays “awaiting confirmation” until you activate it.'
      }
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
                disabled={!canSubmit || isSubmitting || (isEditing && !isDirty)}
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {isEditing ? 'Save terms' : 'Add lab'}
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
        {!isEditing && (
          <FormSection title="Lab">
            <form.Field name="labId">
              {(f) => (
                <FieldWrapper error={fieldError(f)}>
                  <LabPicker
                    open={open}
                    value={f.state.value}
                    onChange={f.handleChange}
                  />
                </FieldWrapper>
              )}
            </form.Field>
          </FormSection>
        )}

        <FormSection title="Terms">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="paymentTermsDays">
                {(f) => (
                  <FieldWrapper
                    label="Payment terms (days)"
                    htmlFor="link-terms"
                    required
                    hint="Days you have to pay the lab's bill."
                    error={fieldError(f)}
                  >
                    <NumberInput
                      id="link-terms"
                      mode="integer"
                      value={f.state.value}
                      onChange={(e) => f.handleChange(e.target.value)}
                      onBlur={f.handleBlur}
                    />
                  </FieldWrapper>
                )}
              </form.Field>
              <form.Field name="patientDataLevel">
                {(f) => (
                  <FormSelect
                    label="Patient details shared"
                    required
                    value={f.state.value}
                    onValueChange={(v) => f.handleChange(v as PatientDataLevel)}
                    options={DATA_OPTIONS}
                    hint={
                      f.state.value === 'code_only'
                        ? 'The lab sees only the patient number.'
                        : 'The lab sees the patient’s name on orders.'
                    }
                  />
                )}
              </form.Field>
            </div>
            <form.Field name="notes">
              {(f) => (
                <FieldWrapper
                  label="Notes"
                  htmlFor="link-notes"
                  hint="Only your clinic sees these."
                  error={fieldError(f)}
                >
                  <Textarea
                    id="link-notes"
                    rows={3}
                    placeholder="e.g. Pickup on Tuesdays and Fridays"
                    value={f.state.value}
                    onChange={(e) => f.handleChange(e.target.value)}
                    onBlur={f.handleBlur}
                  />
                </FieldWrapper>
              )}
            </form.Field>
          </div>
        </FormSection>
      </form>
    </FormSheet>
  )
}

/** Searchable list of directory labs; ones already on the list can't be picked. */
function LabPicker({
  open,
  value,
  onChange,
}: {
  open: boolean
  value: string
  onChange: (labId: string) => void
}) {
  const [search, setSearch] = useState('')
  const query = useDebounce(search, 300).trim()
  const { data, isLoading, isError, refetch } = useAvailableLabs(query, open)

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-3" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search labs by name or city…"
          aria-label="Search labs"
          className="pl-9"
        />
      </div>
      <div
        role="radiogroup"
        aria-label="Labs"
        className="max-h-72 space-y-1.5 overflow-y-auto"
      >
        {isLoading ? (
          Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : !data?.length ? (
          <EmptyState
            icon={FlaskConical}
            title={query ? 'No labs match your search' : 'No labs available'}
            description="Can't find your lab? Ask the platform team to add it to the directory."
          />
        ) : (
          data.map((lab) => (
            <LabOption
              key={lab.id}
              lab={lab}
              selected={lab.id === value}
              onSelect={() => onChange(lab.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function LabOption({
  lab,
  selected,
  onSelect,
}: {
  lab: DirectoryLab
  selected: boolean
  onSelect: () => void
}) {
  const taken = !!lab.link
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={taken}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors',
        'hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card',
        selected && 'border-primary bg-primary/5 ring-1 ring-primary',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{lab.name}</p>
        <p className="truncate text-xs text-text-3">
          {[lab.city, lab.phone].filter(Boolean).join(' · ') ||
            'No contact details'}
        </p>
      </div>
      {lab.link ? (
        <LinkStatusBadge status={lab.link.status} />
      ) : (
        lab.labType === 'internal' && <LabTypeBadge type={lab.labType} />
      )}
      {selected && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  )
}
