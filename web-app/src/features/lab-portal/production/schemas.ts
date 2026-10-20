import { z } from 'zod'

const text = (n: number) => z.string().trim().max(n, `At most ${n} characters`)

/** A lab → clinic shipment: one clinic, at least one item. */
export const dispatchSchema = z.object({
  itemIds: z.array(z.string()).min(1, 'Choose at least one item'),
  courierName: text(100),
  trackingNo: text(100),
  notes: text(2000),
})
export type DispatchValues = z.input<typeof dispatchSchema>

export const assignSchema = z.object({
  labMemberId: z.string().min(1, 'Choose a technician'),
})
export type AssignValues = z.input<typeof assignSchema>
