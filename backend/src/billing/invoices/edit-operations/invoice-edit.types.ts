import { EntityManager } from 'typeorm';
import { BillingContext } from '../../common/billing-context';
import { ClinicTime } from '../../common/billing-clock.service';
import { Charge } from '../../entities/charge.entity';
import { Invoice } from '../../entities/invoice.entity';
import { DiscountKind } from '../../enums/billing.enums';

export const INVOICE_EDIT_OPS = [
  'updateQuantity',
  'setUnitPrice',
  'setDiscount',
  'removeDiscount',
  'voidCharge',
  'addCharges',
  'addManualCharge',
] as const;
export type InvoiceEditOp = (typeof INVOICE_EDIT_OPS)[number];

/** Typed commands (6.7); the DTO is parsed into one of these per handler. */
export type InvoiceEditOperation =
  | { op: 'updateQuantity'; chargeId: string; quantity: number }
  | { op: 'setUnitPrice'; chargeId: string; unitPrice: number }
  | {
      op: 'setDiscount';
      chargeId: string;
      discountTypeId: string | null;
      kind?: DiscountKind;
      value?: number;
      note: string | null;
    }
  | { op: 'removeDiscount'; chargeId: string }
  | { op: 'voidCharge'; chargeId: string }
  | { op: 'addCharges'; chargeIds: string[] }
  | {
      op: 'addManualCharge';
      serviceId: string | null;
      description: string | null;
      quantity: number;
      unitPrice: number | null;
      doctorId: string | null;
    };

/** Raw command as sent by the client (validated DTO). */
export type InvoiceEditOperationInput = { op: InvoiceEditOp } & Partial<{
  chargeId: string;
  chargeIds: string[];
  quantity: number;
  unitPrice: number;
  discountTypeId: string;
  kind: DiscountKind;
  value: number;
  note: string;
  serviceId: string;
  description: string;
  doctorId: string;
}>;

/** Shared state of one edit; charges are locked rows mutated in memory. */
export interface InvoiceEditContext {
  readonly manager: EntityManager;
  readonly ctx: BillingContext;
  readonly invoice: Invoice;
  /** Every charge on the invoice plus those being added, by id. */
  readonly charges: Map<string, Charge>;
  readonly reason: string;
  readonly time: ClinicTime;
}

export interface InvoiceEditOperationHandler<T extends InvoiceEditOperation> {
  readonly op: T['op'];
  /** Checks required fields; throws billingError. */
  parse(input: InvoiceEditOperationInput): T;
  apply(cmd: T, ctx: InvoiceEditContext): void | Promise<void>;
}

/** A missing handler fails to compile. */
export type InvoiceEditHandlerRegistry = {
  [K in InvoiceEditOp]: InvoiceEditOperationHandler<
    Extract<InvoiceEditOperation, { op: K }>
  >;
};
