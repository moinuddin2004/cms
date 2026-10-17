import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { MoneyColumn } from '../common/money-column';
import { PrintFormat } from '../enums/billing.enums';
import { DEFAULT_DUE_DAYS } from '../billing.constants';

/**
 * Billing settings of one location (5.4), created lazily with defaults.
 *
 * `documentCode` is the `{LOC}` part of document numbers. It lives here
 * instead of `locations.code` because that column is a free-form, required
 * code (up to 50 chars) that does not fit `^[A-Z0-9]{2,6}$` (V5); it is
 * seeded from it when it does. Locked once the first number is issued.
 */
@Entity({ name: 'location_billing_settings' })
export class LocationBillingSettings {
  @PrimaryColumn({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'document_code', type: 'varchar', length: 6, nullable: true })
  documentCode: string | null;

  @Column({ name: 'due_days', type: 'int', default: DEFAULT_DUE_DAYS })
  dueDays: number;

  @Column({
    name: 'invoice_print_format',
    type: 'enum',
    enum: PrintFormat,
    default: PrintFormat.A4,
  })
  invoicePrintFormat: PrintFormat;

  @Column({
    name: 'receipt_print_format',
    type: 'enum',
    enum: PrintFormat,
    default: PrintFormat.A4,
  })
  receiptPrintFormat: PrintFormat;

  @Column({ name: 'show_logo', type: 'boolean', default: true })
  showLogo: boolean;

  @Column({ name: 'show_previous_balance', type: 'boolean', default: true })
  showPreviousBalance: boolean;

  @Column({
    name: 'show_outstanding_at_check_in',
    type: 'boolean',
    default: true,
  })
  showOutstandingAtCheckIn: boolean;

  @Column({ name: 'footer_note', type: 'varchar', length: 300, nullable: true })
  footerNote: string | null;

  @Column({
    name: 'default_consultation_service_id',
    type: 'uuid',
    nullable: true,
  })
  defaultConsultationServiceId: string | null;

  @Column({ name: 'default_payment_account_id', type: 'uuid', nullable: true })
  defaultPaymentAccountId: string | null;

  @MoneyColumn('cash_variance_alert_amount')
  cashVarianceAlertAmount: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
