import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity({ name: 'purchase_order_items' })
@Index(['purchaseOrderId'])
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  @Column()
  inventoryItemId: string;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  orderedQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  receivedQuantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;
  // orderedQuantity × unitPrice — calculated in service before save

  @Column({ type: 'varchar', nullable: true })
  batchNumber: string | null;

  @Column({ type: 'date', nullable: true })
  expiryDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @Column({ default: 0 })
  sortOrder: number;
}
