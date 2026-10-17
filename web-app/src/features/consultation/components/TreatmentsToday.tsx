import { useState } from 'react'
import { Loader2, Plus, Syringe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Treatment } from '@/features/patients'
import { PROCEDURE_PICKS } from '../constants/quickPicks'
import { useAddTreatment, useProcedureCatalog } from '../hooks/useConsultation'
import {
  OTHER_PROCEDURE,
  SEARCH_THRESHOLD,
  buildTreatmentInput,
  filterProcedures,
} from '../utils/treatmentInput'
import { Chip } from './Chip'

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
  const add = useAddTreatment(encounterId, patientId)
  const catalogQuery = useProcedureCatalog()
  const catalog = catalogQuery.data ?? []
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [tooth, setTooth] = useState('')
  const [filter, setFilter] = useState('')

  const hasCatalog = catalog.length > 0
  const typing = !hasCatalog || selected === OTHER_PROCEDURE
  const input = buildTreatmentInput({ selected, name, tooth }, catalog)
  const canAdd = input !== null && !add.isPending
  const visible = filterProcedures(catalog, filter)

  const submit = () => {
    if (!input || add.isPending) return
    add.mutate(input, {
      onSuccess: () => {
        setSelected(null)
        setName('')
        setTooth('')
        setFilter('')
      },
    })
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Syringe className="size-4 text-primary-text" />
        Treatment done today
        {treatments.length > 0 && (
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-text">
            {treatments.length}
          </span>
        )}
      </h2>

      {treatments.length > 0 && (
        <ul className="mb-3 divide-y rounded-md border border-border">
          {treatments.map((t) => (
            <li key={t.id} className="px-3 py-2.5">
              <p className="truncate text-sm font-medium">{t.treatmentName}</p>
              {t.notes && (
                <p className="truncate text-xs text-muted-foreground">
                  {t.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {catalogQuery.isLoading ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Loading procedures…
        </p>
      ) : (
        <>
          {hasCatalog && catalog.length > SEARCH_THRESHOLD && (
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search procedures"
              aria-label="Search procedures"
              className="mb-2 h-11 text-base"
            />
          )}
          <div className="mb-3 flex flex-wrap gap-2">
            {hasCatalog ? (
              <>
                {visible.map((p) => (
                  <Chip
                    key={p.id}
                    active={selected === p.id}
                    onClick={() => setSelected(p.id)}
                  >
                    {p.name}
                  </Chip>
                ))}
                <Chip
                  active={selected === OTHER_PROCEDURE}
                  onClick={() => setSelected(OTHER_PROCEDURE)}
                >
                  Other…
                </Chip>
              </>
            ) : (
              PROCEDURE_PICKS.map((p) => (
                <Chip key={p} active={name === p} onClick={() => setName(p)}>
                  {p}
                </Chip>
              ))
            )}
          </div>
        </>
      )}

      <form
        className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_96px_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {typing && (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Procedure"
            aria-label="Procedure"
            className="col-span-2 h-11 text-base sm:col-span-1"
          />
        )}
        <Input
          value={tooth}
          onChange={(e) => setTooth(e.target.value)}
          placeholder="Tooth #"
          aria-label="Tooth number"
          className={
            typing
              ? 'h-11 text-base'
              : 'col-span-2 h-11 text-base sm:col-span-2'
          }
        />
        <Button
          type="submit"
          disabled={!canAdd}
          className="col-span-2 h-11 text-base sm:col-span-1"
        >
          {add.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add
        </Button>
      </form>
    </section>
  )
}
