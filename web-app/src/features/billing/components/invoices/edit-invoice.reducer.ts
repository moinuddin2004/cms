import type { Charge, InvoiceEditOp } from '../../types/billing.types'

/**
 * Edit-invoice sheet state (Reducer, plan §13.5). Holds only what the user
 * changed; `toOperations` turns it into the server's command list.
 */
export interface ChargeEdit {
  quantity?: number
  unitPrice?: string
  void?: boolean
  /** string = discount type id; null = remove the current discount. */
  discountTypeId?: string | null
}

export interface EditInvoiceState {
  edits: Record<string, ChargeEdit>
  addChargeIds: string[]
  reason: string
}

export type EditInvoiceAction =
  | { type: 'reset' }
  | { type: 'edit'; chargeId: string; patch: ChargeEdit }
  | { type: 'toggleAdd'; chargeId: string }
  | { type: 'reason'; value: string }

export const emptyEditState: EditInvoiceState = {
  edits: {},
  addChargeIds: [],
  reason: '',
}

export function editInvoiceReducer(
  state: EditInvoiceState,
  action: EditInvoiceAction,
): EditInvoiceState {
  switch (action.type) {
    case 'reset':
      return emptyEditState
    case 'edit':
      return {
        ...state,
        edits: {
          ...state.edits,
          [action.chargeId]: {
            ...state.edits[action.chargeId],
            ...action.patch,
          },
        },
      }
    case 'toggleAdd':
      return {
        ...state,
        addChargeIds: state.addChargeIds.includes(action.chargeId)
          ? state.addChargeIds.filter((id) => id !== action.chargeId)
          : [...state.addChargeIds, action.chargeId],
      }
    case 'reason':
      return { ...state, reason: action.value }
  }
}

const isPrice = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim())

/** Only real changes become commands; invalid typed prices are skipped. */
export function toOperations(
  state: EditInvoiceState,
  charges: Charge[],
): InvoiceEditOp[] {
  const ops: InvoiceEditOp[] = []
  for (const c of charges) {
    const e = state.edits[c.id] as ChargeEdit | undefined
    if (!e) continue
    if (e.void) {
      ops.push({ op: 'voidCharge', chargeId: c.id })
      continue
    }
    if (
      e.quantity !== undefined &&
      e.quantity >= 1 &&
      e.quantity !== c.quantity
    ) {
      ops.push({ op: 'updateQuantity', chargeId: c.id, quantity: e.quantity })
    }
    if (
      e.unitPrice !== undefined &&
      isPrice(e.unitPrice) &&
      Number(e.unitPrice) !== c.unitPrice
    ) {
      ops.push({
        op: 'setUnitPrice',
        chargeId: c.id,
        unitPrice: Number(e.unitPrice),
      })
    }
    if (e.discountTypeId === null && c.discount)
      ops.push({ op: 'removeDiscount', chargeId: c.id })
    if (e.discountTypeId && e.discountTypeId !== c.discount?.typeId) {
      ops.push({
        op: 'setDiscount',
        chargeId: c.id,
        discountTypeId: e.discountTypeId,
      })
    }
  }
  if (state.addChargeIds.length)
    ops.push({ op: 'addCharges', chargeIds: state.addChargeIds })
  return ops
}
