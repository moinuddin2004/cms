import { useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { paisaToRupeesText } from '@/features/lab-catalog'
import {
  approveBillSchema,
  payLabSchema,
  statementSchema,
} from '../schemas/lab-payables.schema'
import type {
  ApproveBillValues,
  PayLabValues,
  StatementValues,
} from '../schemas/lab-payables.schema'
import type { VendorBill } from '../types'

const today = () => new Date().toISOString().slice(0, 10)

export function useApproveBillForm({
  bill,
  onSubmit,
}: {
  bill: VendorBill | null
  onSubmit: (v: ApproveBillValues) => Promise<unknown>
}) {
  const initial = (): ApproveBillValues => ({
    vendorInvoiceNo: bill?.vendorInvoiceNo ?? '',
    dueOn: bill?.dueOn ?? '',
    taxPercent: bill ? String(bill.taxBp / 100) : '0',
  })
  const form = useForm({
    defaultValues: initial(),
    validators: { onChange: approveBillSchema, onSubmit: approveBillSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (bill) form.reset(initial())
  }, [bill?.id, bill?.version])
  return form
}

/** `bills`: the lab's open bills, pre-filled with `prefillBillId`'s balance. */
export function usePayLabForm({
  open,
  bills,
  prefillBillId,
  onSubmit,
}: {
  open: boolean
  bills: VendorBill[]
  prefillBillId?: string
  onSubmit: (v: PayLabValues) => Promise<unknown>
}) {
  const initial = (): PayLabValues => {
    const pre = bills.find((b) => b.id === prefillBillId)
    return {
      amount: pre ? paisaToRupeesText(pre.balancePaisa) : '',
      method: 'bank_transfer',
      reference: '',
      paidOn: today(),
      allocations: bills.map((b) => ({
        billId: b.id,
        billNo: b.billNo,
        balancePaisa: b.balancePaisa,
        amount: b.id === prefillBillId ? paisaToRupeesText(b.balancePaisa) : '',
      })),
    }
  }
  const form = useForm({
    defaultValues: initial(),
    validators: { onChange: payLabSchema, onSubmit: payLabSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  const key = bills.map((b) => `${b.id}:${b.version}`).join(',')
  useEffect(() => {
    if (open) form.reset(initial())
  }, [open, key, prefillBillId])
  return form
}

export function useStatementForm({
  open,
  onSubmit,
}: {
  open: boolean
  onSubmit: (v: StatementValues) => Promise<unknown>
}) {
  const empty: StatementValues = {
    labId: '',
    periodStart: '',
    periodEnd: '',
    statementRef: '',
    lines: '',
  }
  const form = useForm({
    defaultValues: empty,
    validators: { onChange: statementSchema, onSubmit: statementSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (open) form.reset(empty)
  }, [open])
  return form
}
