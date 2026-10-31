import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/forms/NumberInput'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { FieldWrapper } from '@/components/forms/FieldWrapper'
import { cn } from '@/lib/utils'
import { Money } from '../shared/billing-badges'
import { useCollect } from './collect-context'
import { parseAmount } from './collect-payment.reducer'

/** Amount, payment account, reference, notes, advance and mode (plan §8.2.5). */
export function CollectPaymentFields() {
  const { state, dispatch, accounts, summary } = useCollect()
  const account = accounts.find((a) => a.id === state.accountId)
  const amountInvalid = parseAmount(state.amount) === null
  const advance = summary?.advance ?? 0

  return (
    <section className="space-y-4" aria-label="Payment">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldWrapper
          label="Amount received (Rs)"
          htmlFor="collect-amount"
          error={amountInvalid ? 'Enter an amount (max 2 decimals)' : undefined}
        >
          <NumberInput
            id="collect-amount"
            className="h-11 text-right text-lg font-semibold"
            value={state.amount}
            onChange={(e) =>
              dispatch({ type: 'amount', amount: e.target.value })
            }
            autoFocus
          />
        </FieldWrapper>
        <FieldWrapper label="Allocation">
          <div
            className="flex overflow-hidden rounded-lg border border-border text-xs"
            role="radiogroup"
            aria-label="Allocation mode"
          >
            {(['AUTO', 'MANUAL'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={state.mode === m}
                onClick={() => dispatch({ type: 'mode', mode: m })}
                className={cn(
                  'flex-1 px-3 py-2 font-medium transition-colors',
                  state.mode === m
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                {m === 'AUTO' ? 'Oldest first' : 'Manual'}
              </button>
            ))}
          </div>
        </FieldWrapper>
      </div>

      <FieldWrapper label="Received in">
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Payment account"
        >
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={state.accountId === a.id}
              onClick={() => dispatch({ type: 'account', accountId: a.id })}
              className={cn(
                'h-8 rounded-lg border px-3 text-xs font-medium transition-colors',
                state.accountId === a.id
                  ? 'border-primary bg-primary-soft font-semibold text-primary-text'
                  : 'border-border hover:bg-muted',
              )}
            >
              {a.name}
            </button>
          ))}
        </div>
      </FieldWrapper>

      {account?.requiresReference && (
        <FieldWrapper
          label="Reference number"
          htmlFor="collect-ref"
          required
          hint="Transaction / slip / cheque number"
        >
          <Input
            id="collect-ref"
            value={state.reference}
            onChange={(e) =>
              dispatch({ type: 'reference', value: e.target.value })
            }
            maxLength={80}
          />
        </FieldWrapper>
      )}

      {advance > 0 && (
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
          <span>
            Use advance (<Money value={advance} /> available)
          </span>
          <Switch
            checked={state.applyAdvance}
            onCheckedChange={(v) =>
              dispatch({ type: 'applyAdvance', value: v })
            }
            aria-label="Use advance"
          />
        </label>
      )}

      <FieldWrapper label="Notes" htmlFor="collect-notes">
        <Textarea
          id="collect-notes"
          dir="auto"
          rows={2}
          maxLength={300}
          value={state.notes}
          onChange={(e) => dispatch({ type: 'notes', value: e.target.value })}
        />
      </FieldWrapper>
    </section>
  )
}
