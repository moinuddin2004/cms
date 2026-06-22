import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ConsumptionTemplate } from './consumption-template.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity({ name: 'consumption_template_items' })
@Index(['templateId'])
export class ConsumptionTemplateItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  templateId: string;

  @ManyToOne(() => ConsumptionTemplate, (t) => t.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'templateId' })
  template: ConsumptionTemplate;

  @Column()
  inventoryItemId: string;

  @ManyToOne(() => InventoryItem, { eager: true })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;
  // eager: true so item name, unit, price auto-loads with template

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;
  // Default suggested quantity for this procedure
  // Example: Gloves = 2 pairs, Anesthetic = 1 cartridge

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;
  // Hints for doctor: "use 2 if molar", "optional for minor cases"

  @Column({ default: 0 })
  sortOrder: number;
}
