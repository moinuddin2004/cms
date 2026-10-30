import { useState } from 'react'
import { useStore } from '@tanstack/react-form'
import { CheckCircle2, Loader2, Plus, Syringe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fieldError } from '@/components/forms/fieldError'
import type { Treatment } from '@/features/patients'
import { PROCEDURE_PICKS } from '../constants/quickPicks'
import { useProcedureCatalog } from '../hooks/useConsultation'
import { useTreatmentForm } from '../hooks/useTreatmentForm'
import {
  OTHER_PROCEDURE,
  SEARCH_THRESHOLD,
  buildTreatmentInput,
  filterProcedures,
} from '../utils/treatmentInput'
import { Chip, ChipGroup } from './Chip'
import { Panel, PanelBadge } from './Panel'

/**
 * Treatments done in this visit. Tap a procedure from the clinic's service
 * catalog, optionally add the tooth, and press Add — it lands in the patient's
 * history and billing prices it. The doctor never sees or types a fee.
 */
export function TreatmentsToday({
  encounterId,
  patientId,
  treatments,
}: {
  encounterId: string
  patientId: string
  treatments: Treatment[]
}) {
  const catalogQuery = useProcedureCatalog()
  const catalog = catalogQuery.data ?? []
  const [filter, setFilter] = useState('')
  const { form, add } = useTreatmentForm({
    encounterId,
    patientId,
    catalog,
    onAdded: () => setFilter(''),
  })
  const values = useStore(form.store, (s) => s.values)
  const { selected, name } = values

  const hasCatalog = catalog.length > 0
  const typing = !hasCatalog || selected === OTHER_PROCEDURE
  // Add stays off until the row is complete (a pick, or a typed name).
  const complete = buildTreatmentInput(values, catalog) !== null
  const visible = filterProcedures(catalog, filter)
  const pick = (value: string) => form.setFieldValue('selected', value)

  return (
    <Panel
      icon={<Syringe />}
      title="Treatment done today"
      badge={
        treatments.length > 0 ? (
          <PanelBadge>{treatments.length}</PanelBadge>
        ) : undefined
      }
      bodyClassName="space-y-3"
    >
      {treatments.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {treatments.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">
                  {t.treatmentName}
                </p>
                {t.notes && (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {t.notes}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {catalogQuery.isLoading ? (
        <p className="text-[13px] text-muted-foreground">Loading procedures…</p>
      ) : (
        <div className="space-y-2">
          {hasCatalog && catalog.length > SEARCH_THRESHOLD && (
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search procedures"
              aria-label="Search procedures"
              className="h-8"
            />
          )}
          {hasCatalog ? (
            <ChipGroup
              items={visible}
              getKey={(p) => p.id}
              getLabel={(p) => p.name}
              isActive={(p) => selected === p.id}
              onPick={(p) => pick(p.id)}
              limit={filter ? visible.length : 8}
              trailing={
                <Chip
                  active={selected === OTHER_PROCEDURE}
                  onClick={() => pick(OTHER_PROCEDURE)}
                >
                  Other…
                </Chip>
              }
            />
          ) : (
            <ChipGroup
              items={PROCEDURE_PICKS}
              getKey={(p) => p}
              getLabel={(p) => p}
              isActive={(p) => name === p}
              onPick={(p) => form.setFieldValue('name', p)}
              limit={8}
            />
          )}
        </div>
      )}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
      >
        {typing && (
          <form.Field name="name">
            {(field) => (
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                placeholder="Procedure"
                aria-label="Procedure"
                aria-invalid={!!fieldError(field)}
                className="h-9 min-w-40 flex-1"
              />
            )}
          </form.Field>
        )}
        <form.Field name="tooth">
          {(field) => (
            <Input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Tooth #"
              aria-label="Tooth number"
              aria-invalid={!!fieldError(field)}
              className={typing ? 'h-9 w-24' : 'h-9 min-w-24 flex-1'}
            />
          )}
        </form.Field>
        <form.Subscribe
          selector={(s) => [s.canSubmit, s.isSubmitting] as const}
        >
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={
                !complete || !canSubmit || isSubmitting || add.isPending
              }
              className="h-9"
            >
              {add.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Add
            </Button>
          )}
        </form.Subscribe>
        {/* Errors sit on their own line under the row. */}
        {typing && (
          <form.Field name="name">
            {(field) =>
              fieldError(field) && (
                <p className="w-full text-xs text-destructive">
                  {fieldError(field)}
                </p>
              )
            }
          </form.Field>
        )}
        <form.Field name="tooth">
          {(field) =>
            fieldError(field) && (
              <p className="w-full text-xs text-destructive">
                {fieldError(field)}
              </p>
            )
          }
        </form.Field>
      </form>
    </Panel>
  )
}
