import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { FormSchemaVersion } from 'src/engine/entities/form-schema-version.entity';
import { LabOrderItem } from './lab-order-item.entity';

/**
 * One tooth of an item (lab ERD §5a): a 3-unit bridge is one item with
 * three rows. Written at submit (and by revisions) from the item's
 * `tooth_chart` answer — the form response stays the source of truth.
 */
@Entity({ name: 'item_teeth' })
@Unique('uq_item_teeth_tooth', ['itemId', 'toothCode'])
@Check(
  'chk_item_teeth_numbering',
  `"numbering_system" IN ('FDI','UNIVERSAL','PALMER')`,
)
@Index('idx_item_teeth_item', ['itemId'])
export class ItemTooth {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => LabOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: LabOrderItem;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({
    name: 'numbering_system',
    type: 'varchar',
    length: 10,
    default: 'FDI',
  })
  numberingSystem: string;

  @Column({ name: 'tooth_code', type: 'varchar', length: 5 })
  toothCode: string;

  @Column({ name: 'dentition', type: 'varchar', length: 10 })
  dentition: string;

  @Column({ name: 'tooth_role', type: 'varchar', length: 20, nullable: true })
  toothRole: string | null;

  @Column({
    name: 'surfaces',
    type: 'text',
    array: true,
    default: () => `'{}'`,
  })
  surfaces: string[];
}

/**
 * Typed dental columns promoted from the form answers at submit (lab ERD
 * §3 promotions) so reports read columns, not JSON. The only
 * specialty-specific table the order code touches, and only through the
 * form's `promotions` map.
 */
@Entity({ name: 'dental_item_details' })
export class DentalItemDetails {
  @PrimaryColumn({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @OneToOne(() => LabOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: LabOrderItem;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'shade_system', type: 'varchar', length: 50, nullable: true })
  shadeSystem: string | null;

  @Column({ name: 'shade', type: 'varchar', length: 20, nullable: true })
  shade: string | null;

  @Column({
    name: 'material_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  materialCode: string | null;

  @Column({
    name: 'implant_system',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  implantSystem: string | null;

  @Column({
    name: 'implant_platform',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  implantPlatform: string | null;

  @Column({
    name: 'implant_diameter_mm',
    type: 'numeric',
    precision: 4,
    scale: 2,
    nullable: true,
  })
  implantDiameterMm: string | null;

  @Column({ name: 'margin_type', type: 'varchar', length: 50, nullable: true })
  marginType: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

/**
 * The item's form answers against its pinned form version. Drafts store
 * whatever was typed (`validated_at` null); submit validates and stores
 * the normalised answers.
 */
@Entity({ name: 'item_form_responses' })
export class ItemFormResponse {
  @PrimaryColumn({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @OneToOne(() => LabOrderItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: LabOrderItem;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => FormSchemaVersion, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'form_schema_version_id' })
  formSchemaVersion: FormSchemaVersion | null;

  @Column({ name: 'form_schema_version_id', type: 'uuid', nullable: true })
  formSchemaVersionId: string | null;

  @Column({ name: 'data', type: 'jsonb', default: () => `'{}'::jsonb` })
  data: Record<string, unknown>;

  @Column({ name: 'validated_at', type: 'timestamptz', nullable: true })
  validatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
