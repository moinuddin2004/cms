import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Specialty } from 'src/engine/entities/specialty.entity';

/**
 * Groups lab services within a specialty (CROWN, BRIDGE, DENTURE …).
 * Platform-level: every lab files its services under the same categories,
 * so clinics can compare labs like for like.
 */
@Entity({ name: 'service_categories' })
@Unique('uq_service_categories_code', ['specialtyId', 'code'])
@Index('idx_service_categories_specialty', [
  'specialtyId',
  'isActive',
  'sortOrder',
])
export class ServiceCategory {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Specialty, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'specialty_id' })
  specialty: Specialty;

  @Column({ name: 'specialty_id', type: 'uuid' })
  specialtyId: string;

  /** Upper-case, stable: `CROWN`. */
  @Column({ name: 'code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

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
