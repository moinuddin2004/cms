import { useEffect } from 'react'
import { todayYmd } from '@/lib/datetime'
import { useForm } from '@tanstack/react-form'
import { minorToRupeesText } from '@/features/lab-catalog'
import {
  allocateSchema,
  approveBillSchema,
  billLineSchema,
  editBillSchema,
  payLabSchema,
  statementSchema,
} from '../schemas/lab-payables.schema'
import type {
  AllocateValues,
  ApproveBillValues,
  BillLineValues,
  EditBillValues,
  PayLabValues,
  StatementValues,
} from '../schemas/lab-payables.schema'
import type { VendorBill, VendorPayment } from '../types'

const today = todayYmd

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
      amount: pre ? minorToRupeesText(pre.balanceMinor) : '',
      method: 'bank_transfer',
      reference: '',
      paidOn: today(),
      allocations: bills.map((b) => ({
        billId: b.id,
        billNo: b.billNo,
        balanceMinor: b.balanceMinor,
        amount: b.id === prefillBillId ? minorToRupeesText(b.balanceMinor) : '',
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

export function useEditBillForm({
  bill,
  onSubmit,
}: {
  bill: VendorBill | null
  onSubmit: (v: EditBillValues) => Promise<unknown>
}) {
  const initial = (): EditBillValues => ({
    vendorInvoiceNo: bill?.vendorInvoiceNo ?? '',
    billDate: bill?.billDate ?? today(),
    dueOn: bill?.dueOn ?? '',
    taxPercent: bill ? String(bill.taxBp / 100) : '0',
    notes: bill?.notes ?? '',
  })
  const form = useForm({
    defaultValues: initial(),
    validators: { onChange: editBillSchema, onSubmit: editBillSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (bill) form.reset(initial())
  }, [bill?.id, bill?.version])
  return form
}

export function useBillLineForm({
  open,
  onSubmit,
}: {
  open: boolean
  onSubmit: (v: BillLineValues) => Promise<unknown>
}) {
  const empty: BillLineValues = {
    kind: 'other',
    description: '',
    quantity: '1',
    unitCost: '',
  }
  const form = useForm({
    defaultValues: empty,
    validators: { onChange: billLineSchema, onSubmit: billLineSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  useEffect(() => {
    if (open) form.reset(empty)
  }, [open])
  return form
}

/** `bills`: the payment's lab's open (approved) bills. */
export function useAllocateForm({
  payment,
  bills,
  onSubmit,
}: {
  payment: VendorPayment | null
  bills: VendorBill[]
  onSubmit: (v: AllocateValues) => Promise<unknown>
}) {
  const initial = (): AllocateValues => ({
    freeMinor: payment?.unallocatedMinor ?? 0,
    allocations: bills.map((b) => ({
      billId: b.id,
      billNo: b.billNo,
      balanceMinor: b.balanceMinor,
      amount: '',
    })),
  })
  const form = useForm({
    defaultValues: initial(),
    validators: { onChange: allocateSchema, onSubmit: allocateSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })
  const key = bills.map((b) => `${b.id}:${b.version}`).join(',')
  useEffect(() => {
    if (payment) form.reset(initial())
  }, [payment?.id, payment?.version, key])
  return form
}
