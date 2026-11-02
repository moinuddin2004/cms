import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { Employee } from '../../employees/entities/employee.entity';

export enum StockMovementType {
  PURCHASE_IN = 'PURCHASE_IN', // stock received from purchase order
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT', // admin manually corrected stock count
  CONSUMPTION = 'CONSUMPTION', // used during patient treatment
  WASTAGE = 'WASTAGE', // expired/damaged items disposed
  TRANSFER_IN = 'TRANSFER_IN', // received from another location
  TRANSFER_OUT = 'TRANSFER_OUT', // sent to another location
  RETURN_TO_SUPPLIER = 'RETURN_TO_SUPPLIER', // returned defective/excess items
  INITIAL_STOCK = 'INITIAL_STOCK', // first-time stock entry when item created
}

@Entity({ name: 'stock_movements' })
@Index(['inventoryItemId', 'createdAt'])
@Index(['organizationId', 'locationId', 'movementType'])
@Index(['referenceType', 'referenceId'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  inventoryItemId: string;

  @ManyToOne(() => InventoryItem, (item) => item.stockMovements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @Column()
  organizationId: string;

  @Column()
  locationId: string;

  @Column({ type: 'enum', enum: StockMovementType })
  movementType: StockMovementType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;
  // Positive = stock coming IN (PURCHASE_IN, MANUAL_ADJUSTMENT up, TRANSFER_IN, INITIAL_STOCK)
  // Negative = stock going OUT (CONSUMPTION, WASTAGE, TRANSFER_OUT, RETURN_TO_SUPPLIER)

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  previousStock: number;
  // Snapshot of item.currentStock BEFORE this movement

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  newStock: number;
  // Snapshot of item.currentStock AFTER this movement
  // newStock = previousStock + quantity

  @Column({ type: 'varchar', nullable: true })
  referenceType: string | null;
  // What triggered this movement:
  // 'purchase_order' | 'appointment' | 'treatment_plan' | 'manual' | 'transfer'

  @Column({ type: 'varchar', nullable: true })
  referenceId: string | null;
  // ID of the purchase order, appointment, etc.

  @Column({ type: 'varchar', nullable: true })
  batchNumber: string | null;
  // Batch/lot number for tracking specific batches

  @Column({ type: 'date', nullable: true })
  expiryDate: Date | null;
  // Expiry date of this specific batch (different batches can have different expiry)

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column()
  performedBy: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'performedBy' })
  performer: Employee;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
