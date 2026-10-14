import { useState } from 'react'
import { Loader2, Plus, Syringe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Treatment } from '@/features/patients'
import { PROCEDURE_PICKS } from '../constants/quickPicks'
import { useAddTreatment } from '../hooks/useConsultation'
import { Chip } from './Chip'

const money = (v: number | string | null | undefined) =>
  v == null || v === '' ? null : Number(v)

/**
 * Treatments done in this visit. Tap a procedure, optionally add the tooth and
 * the fee, and press Add — it lands in the patient's history and billing data.
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
  const [name, setName] = useState('')
  const [tooth, setTooth] = useState('')
  const [cost, setCost] = useState('')

  const canAdd = name.trim().length > 0 && !add.isPending

  const submit = () => {
    if (!canAdd) return
    const fee = cost.trim() === '' ? undefined : Number(cost)
    if (fee !== undefined && (Number.isNaN(fee) || fee < 0)) return
    add.mutate(
      {
        treatmentName: name.trim(),
        notes: tooth.trim() ? `Tooth: ${tooth.trim()}` : undefined,
        cost: fee,
      },
      {
        onSuccess: () => {
          setName('')
          setTooth('')
          setCost('')
        },
      },
    )
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
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {t.treatmentName}
                </p>
                {t.notes && (
                  <p className="truncate text-xs text-muted-foreground">
                    {t.notes}
                  </p>
                )}
              </div>
              {money(t.cost) != null && (
                <span className="shrink-0 text-sm font-semibold">
                  Rs. {money(t.cost)!.toLocaleString()}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {PROCEDURE_PICKS.map((p) => (
          <Chip key={p} active={name === p} onClick={() => setName(p)}>
            {p}
          </Chip>
        ))}
      </div>

      <form
        className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_96px_120px_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Procedure"
          aria-label="Procedure"
          className="col-span-2 h-11 text-base sm:col-span-1"
        />
        <Input
          value={tooth}
          onChange={(e) => setTooth(e.target.value)}
          placeholder="Tooth #"
          aria-label="Tooth number"
          className="h-11 text-base"
        />
        <Input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="Fee (Rs.)"
          aria-label="Fee"
          inputMode="decimal"
          className="h-11 text-base"
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
