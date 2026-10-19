import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { PaisaColumn } from 'src/billing/common/paisa-column';
import { OptionType } from '../enums/catalog.enums';
import { LabService } from './lab-service.entity';

/**
 * A material or variant of a lab service (e.g. "Emax" on a crown), with
 * the lab's extra cost per unit on top of the resolved service price.
 */
@Entity({ name: 'lab_service_options' })
@Unique('uq_lab_service_options_code', ['labServiceId', 'code'])
@Check('chk_lab_service_options_cost', `"extra_cost_paisa" >= 0`)
export class LabServiceOption {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => LabService, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_service_id' })
  labService: LabService;

  @Column({ name: 'lab_service_id', type: 'uuid' })
  labServiceId: string;

  @Column({ name: 'option_type', type: 'enum', enum: OptionType })
  optionType: OptionType;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @PaisaColumn('extra_cost_paisa')
  extraCostPaisa: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}
