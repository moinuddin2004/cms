import { useState } from 'react'
import { CheckCircle2, Loader2, Plus, Syringe } from 'lucide-react'
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
              onPick={(p) => setSelected(p.id)}
              limit={filter ? visible.length : 8}
              trailing={
                <Chip
                  active={selected === OTHER_PROCEDURE}
                  onClick={() => setSelected(OTHER_PROCEDURE)}
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
              onPick={setName}
              limit={8}
            />
          )}
        </div>
      )}

      <form
        className="flex flex-wrap gap-2"
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
            className="h-9 min-w-40 flex-1"
          />
        )}
        <Input
          value={tooth}
          onChange={(e) => setTooth(e.target.value)}
          placeholder="Tooth #"
          aria-label="Tooth number"
          className={typing ? 'h-9 w-24' : 'h-9 min-w-24 flex-1'}
        />
        <Button type="submit" disabled={!canAdd} className="h-9">
          {add.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add
        </Button>
      </form>
    </Panel>
  )
}
