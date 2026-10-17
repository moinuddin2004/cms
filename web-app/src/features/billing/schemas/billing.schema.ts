import { z } from 'zod'

// Zod schemas mirroring the backend DTOs (same limits, same required rules).
// Money fields are edited as strings and parsed on submit.

const money = (
  label: string,
  opts: { min?: number; required?: boolean } = {},
) =>
  z
    .string()
    .trim()
    .refine(
      (v) =>
        (opts.required === false && v === '') || /^\d+(\.\d{1,2})?$/.test(v),
      `${label}: enter an amount (max 2 decimals)`,
    )
    .refine(
      (v) => v === '' || Number(v) >= (opts.min ?? 0),
      `${label} must be at least ${opts.min ?? 0}`,
    )

export const toAmount = (v: string): number =>
  Math.round(Number(v || 0) * 100) / 100

export const reasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Reason must be at least 5 characters')
    .max(300),
})
export type ReasonValues = z.infer<typeof reasonSchema>

export const manualChargeSchema = z
  .object({
    kind: z.enum(['service', 'other']),
    serviceId: z.string(),
    description: z.string().trim().max(200),
    quantity: z.number().int().min(1, 'At least 1').max(999),
    unitPrice: money('Price', { required: false }),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'service' && !v.serviceId)
      ctx.addIssue({
        code: 'custom',
        path: ['serviceId'],
        message: 'Choose a service',
      })
    if (v.kind === 'other') {
      if (v.description.length < 2)
        ctx.addIssue({
          code: 'custom',
          path: ['description'],
          message: 'Describe the charge',
        })
      if (v.unitPrice === '')
        ctx.addIssue({
          code: 'custom',
          path: ['unitPrice'],
          message: 'Enter a price',
        })
    }
  })
export type ManualChargeValues = z.infer<typeof manualChargeSchema>

export const editChargeSchema = z.object({
  quantity: z.number().int().min(1, 'At least 1').max(999),
  unitPrice: money('Price'),
})
export type EditChargeValues = z.infer<typeof editChargeSchema>

export const discountSchema = z
  .object({
    discountTypeId: z.string(),
    custom: z.boolean(),
    kind: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.string().trim(),
    note: z.string().trim().max(200),
  })
  .superRefine((v, ctx) => {
    if (!v.custom && !v.discountTypeId)
      ctx.addIssue({
        code: 'custom',
        path: ['discountTypeId'],
        message: 'Choose a discount',
      })
    if (v.custom) {
      const n = Number(v.value)
      if (
        !v.value ||
        Number.isNaN(n) ||
        n <= 0 ||
        (v.kind === 'PERCENTAGE' && n > 100)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['value'],
          message: 'Enter a valid value',
        })
      }
      if (v.note.length < 3)
        ctx.addIssue({
          code: 'custom',
          path: ['note'],
          message: 'A reason is required',
        })
    }
  })
export type DiscountValues = z.infer<typeof discountSchema>

export const refundSchema = z.object({
  amount: money('Amount', { min: 0.01 }),
  paymentAccountId: z.string().min(1, 'Choose how the money is returned'),
  referenceNumber: z.string().trim().max(80),
  reason: z
    .string()
    .trim()
    .min(5, 'Reason must be at least 5 characters')
    .max(300),
})
export type RefundValues = z.infer<typeof refundSchema>

export const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  code: z.string().trim().max(30),
  kind: z.enum(['CONSULTATION', 'PROCEDURE', 'OTHER']),
  defaultPrice: money('Default price'),
  sortOrder: z.number().int().min(0),
})
export type ServiceValues = z.infer<typeof serviceSchema>

export const paymentAccountSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(60),
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE_WALLET']),
  bankName: z.string().trim().max(80),
  accountTitle: z.string().trim().max(120),
  accountNumber: z.string().trim().max(40),
  requiresReference: z.boolean(),
  countedInCashClose: z.boolean(),
  sortOrder: z.number().int().min(0),
})
export type PaymentAccountValues = z.infer<typeof paymentAccountSchema>

export const discountTypeSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required').max(80),
    code: z.string().trim().max(30),
    kind: z.enum(['PERCENTAGE', 'FIXED']),
    value: money('Value', { min: 0.01 }),
    maxAmount: money('Max amount', { required: false }),
    appliesTo: z.enum(['ALL', 'SERVICE_KINDS', 'SERVICES']),
    serviceKinds: z.array(z.enum(['CONSULTATION', 'PROCEDURE', 'OTHER'])),
    serviceIds: z.array(z.string()),
    receptionEditable: z.boolean(),
    minValue: money('Min', { required: false }),
    maxValue: money('Max', { required: false }),
    requiresNote: z.boolean(),
    validFrom: z.string(),
    validTo: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'PERCENTAGE' && Number(v.value) > 100) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'At most 100%' })
    }
    if (v.appliesTo === 'SERVICE_KINDS' && !v.serviceKinds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['serviceKinds'],
        message: 'Choose at least one kind',
      })
    }
    if (v.appliesTo === 'SERVICES' && !v.serviceIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['serviceIds'],
        message: 'Choose at least one service',
      })
    }
    if (v.receptionEditable) {
      const [min, val, max] = [
        Number(v.minValue),
        Number(v.value),
        Number(v.maxValue),
      ]
      if (
        v.minValue === '' ||
        v.maxValue === '' ||
        !(min <= val && val <= max)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['maxValue'],
          message: 'Range must satisfy min ≤ value ≤ max',
        })
      }
    }
    if (v.validFrom && v.validTo && v.validFrom > v.validTo) {
      ctx.addIssue({
        code: 'custom',
        path: ['validTo'],
        message: 'Must be after "valid from"',
      })
    }
  })
export type DiscountTypeValues = z.infer<typeof discountTypeSchema>

export const billingSettingsSchema = z.object({
  documentCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, '2–6 letters or digits'),
  dueDays: z.number().int().min(0).max(365),
  invoicePrintFormat: z.enum(['A4', 'THERMAL_80']),
  receiptPrintFormat: z.enum(['A4', 'THERMAL_80']),
  showLogo: z.boolean(),
  showPreviousBalance: z.boolean(),
  showOutstandingAtCheckIn: z.boolean(),
  footerNote: z.string().trim().max(300),
  defaultConsultationServiceId: z.string(),
  defaultPaymentAccountId: z.string(),
  cashVarianceAlertAmount: money('Alert amount'),
})
export type BillingSettingsValues = z.infer<typeof billingSettingsSchema>
