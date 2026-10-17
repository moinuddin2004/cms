import { createContext, useContext } from 'react'
import type { Dispatch } from 'react'
import type {
  Charge,
  PatientBillingSummary,
  PaymentAccount,
  PaymentPreview,
} from '../../types/billing.types'
import type { CollectAction, CollectState } from './collect-payment.reducer'

/** Shared state of the CollectPaymentSheet compound parts. */
export interface CollectContextValue {
  patientId: string
  state: CollectState
  dispatch: Dispatch<CollectAction>
  charges: Charge[]
  chargesLoading: boolean
  accounts: PaymentAccount[]
  summary: PatientBillingSummary | undefined
  preview: PaymentPreview | undefined
  previewPending: boolean
  previewError: string | null
}

export const CollectContext = createContext<CollectContextValue | null>(null)

export function useCollect(): CollectContextValue {
  const ctx = useContext(CollectContext)
  if (!ctx)
    throw new Error('CollectPaymentSheet parts must render inside the sheet')
  return ctx
}
