import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { Location } from '../../locations/entities/location.entity';
import { InventoryCategory } from './inventory-category.entity';
import { StockMovement } from './stock-movement.entity';

export enum ItemUnit {
  PIECES = 'pieces',
  BOXES = 'boxes',
  PAIRS = 'pairs',
  ROLLS = 'rolls',
  BOTTLES = 'bottles',
  PACKETS = 'packets',
  CARTRIDGES = 'cartridges',
  TUBES = 'tubes',
  ML = 'ml',
  GM = 'gm',
  KG = 'kg',
  LITERS = 'liters',
}

@Entity({ name: 'inventory_items' })
@Index(['organizationId', 'locationId', 'isActive'])
@Index(['organizationId', 'locationId', 'currentStock'])
@Index(['expiryDate'])
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => InventoryCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoryId' })
  category: InventoryCategory | null;

  // ─── Item Info ─────────────────────────────────────────
  @Column()
  name: string;
  // Example: "Disposable Gloves (Medium)", "Composite A2", "Lidocaine 2% Cartridge"

  @Column({ type: 'varchar', nullable: true })
  sku: string | null;
  // Internal stock keeping code: "GLV-M-001", "CMP-A2-01"
  // Unique per organization (not globally) — enforced in service, not DB constraint
  // because nullable uniques behave differently across DBs

  @Column({ type: 'varchar', nullable: true })
  barcode: string | null;
  // For future barcode/QR scanning feature

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ─── Stock ─────────────────────────────────────────────
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentStock: number;
  // NEVER update directly — always through StockMovement via adjustStock() method

  @Column({ type: 'enum', enum: ItemUnit, default: ItemUnit.PIECES })
  unit: ItemUnit;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;
  // Last purchase/cost price per unit — updated when PO items are received

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  sellingPrice: number | null;
  // If this item is directly billable to patient (e.g. special materials)

  // ─── Reorder ───────────────────────────────────────────
  @Column({ default: 10 })
  reorderLevel: number;
  // Alert when currentStock drops to or below this number

  @Column({ default: 50 })
  reorderQuantity: number;
  // Suggested quantity to order when reordering

  @Column({ type: 'int', nullable: true })
  maxStock: number | null;
  // Maximum storage capacity — optional, for warehouse management

  // ─── Expiry ────────────────────────────────────────────
  @Column({ type: 'date', nullable: true })
  expiryDate: Date | null;
  // Nearest expiry date among current stock batches
  // Updated when new stock received or expired stock removed

  @Column({ default: 30 })
  expiryAlertDays: number;
  // Alert N days before expiryDate

  // ─── Flags ─────────────────────────────────────────────
  @Column({ default: false })
  isBillable: boolean;
  // Can this item be added to patient invoice as a line item?

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // ─── Relations ─────────────────────────────────────────
  @OneToMany(() => StockMovement, (m) => m.inventoryItem)
  stockMovements: StockMovement[];
}
