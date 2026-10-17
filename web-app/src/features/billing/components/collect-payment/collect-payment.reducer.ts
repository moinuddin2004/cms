import { newClientRequestId } from '../../lib/billing-errors'
import type {
  AllocationMode,
  Charge,
  CollectResult,
} from '../../types/billing.types'

/**
 * Collect-payment sheet state (Reducer, plan §13.5). The sheet never does
 * money math: amounts here are what the user typed; every total shown
 * comes from `/payments/preview`.
 */
export interface CollectState {
  selected: string[]
  /** Charge ids seen so far — new ones (just added) get selected. */
  known: string[]
  /** MANUAL mode: chargeId → typed amount. */
  manual: Record<string, string>
  mode: AllocationMode
  amount: string
  /** False until the user edits the amount — until then it follows the preview. */
  amountTouched: boolean
  accountId: string
  reference: string
  notes: string
  applyAdvance: boolean
  clientRequestId: string
  result: CollectResult | null
}

export type CollectAction =
  | { type: 'init'; charges: Charge[]; preselect?: string[]; accountId: string }
  | { type: 'syncCharges'; charges: Charge[] }
  | { type: 'toggle'; chargeId: string }
  | { type: 'toggleAll'; chargeIds: string[] }
  | { type: 'mode'; mode: AllocationMode }
  | { type: 'manual'; chargeId: string; amount: string }
  | { type: 'amount'; amount: string }
  | { type: 'suggestAmount'; amount: number }
  | { type: 'account'; accountId: string }
  | { type: 'reference'; value: string }
  | { type: 'notes'; value: string }
  | { type: 'applyAdvance'; value: boolean }
  | { type: 'success'; result: CollectResult }

export const initialCollectState = (): CollectState => ({
  selected: [],
  known: [],
  manual: {},
  mode: 'AUTO',
  amount: '',
  amountTouched: false,
  accountId: '',
  reference: '',
  notes: '',
  applyAdvance: true,
  clientRequestId: newClientRequestId(),
  result: null,
})

export function collectReducer(
  state: CollectState,
  action: CollectAction,
): CollectState {
  switch (action.type) {
    case 'init': {
      const ids = action.charges.map((c) => c.id)
      return {
        ...initialCollectState(),
        selected: action.preselect?.filter((id) => ids.includes(id)) ?? ids,
        known: ids,
        accountId: action.accountId,
      }
    }
    case 'syncCharges': {
      // Keep the selection valid after a charge was voided; select new ones.
      const ids = action.charges.map((c) => c.id)
      const kept = state.selected.filter((id) => ids.includes(id))
      const fresh = ids.filter((id) => !state.known.includes(id))
      return { ...state, selected: [...kept, ...fresh], known: ids }
    }
    case 'toggle':
      return {
        ...state,
        selected: state.selected.includes(action.chargeId)
          ? state.selected.filter((id) => id !== action.chargeId)
          : [...state.selected, action.chargeId],
      }
    case 'toggleAll':
      return {
        ...state,
        selected:
          state.selected.length === action.chargeIds.length
            ? []
            : action.chargeIds,
      }
    case 'mode':
      return { ...state, mode: action.mode }
    case 'manual':
      return {
        ...state,
        manual: { ...state.manual, [action.chargeId]: action.amount },
      }
    case 'amount':
      return { ...state, amount: action.amount, amountTouched: true }
    case 'suggestAmount':
      return state.amountTouched
        ? state
        : { ...state, amount: action.amount > 0 ? String(action.amount) : '' }
    case 'account':
      return { ...state, accountId: action.accountId }
    case 'reference':
      return { ...state, reference: action.value }
    case 'notes':
      return { ...state, notes: action.value }
    case 'applyAdvance':
      return { ...state, applyAdvance: action.value }
    case 'success':
      // A new idempotency key only after a success (plan §8.2.8).
      return {
        ...state,
        result: action.result,
        clientRequestId: newClientRequestId(),
      }
  }
}

/** Parsed amount in rupees, or null when not a valid amount. */
export function parseAmount(v: string): number | null {
  if (v.trim() === '') return 0
  return /^\d+(\.\d{1,2})?$/.test(v.trim()) ? Number(v) : null
}
