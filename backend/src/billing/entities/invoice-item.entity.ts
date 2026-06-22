import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { TreatmentPlanItem } from 'src/patients/entities/treatment-plan-item.entity';

@Entity({ name: 'invoice_items' })
@Index(['invoiceId'])
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => TreatmentPlanItem, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'treatment_plan_item_id' })
  treatmentPlanItem: TreatmentPlanItem | null;

  @Column({ name: 'treatment_plan_item_id', type: 'uuid', nullable: true })
  treatmentPlanItemId: string | null;

  @Column({ name: 'description', type: 'varchar', length: 300 })
  description: string;

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
