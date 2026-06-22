import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PatientConsumption } from './patient-consumption.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity({ name: 'patient_consumption_items' })
@Index(['consumptionId'])
export class PatientConsumptionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  consumptionId: string;

  @ManyToOne(() => PatientConsumption, (c) => c.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'consumptionId' })
  consumption: PatientConsumption;

  @Column()
  inventoryItemId: string;

  @ManyToOne(() => InventoryItem, { eager: true })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;
  // Actual quantity doctor used — may differ from template suggestion

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;
  // Snapshot of item's unitPrice at time of consumption
  // Important: prices change over time, we need the price AT consumption time

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;
  // quantity × unitPrice — calculated in service

  @Column({ default: false })
  wasFromTemplate: boolean;
  // true = this item was auto-suggested from template
  // false = doctor manually added this item

  @Column({ default: 0 })
  sortOrder: number;
}
