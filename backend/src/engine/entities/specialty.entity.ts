import {
  Column,
  CreateDateColumn,
  Entity,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';

/**
 * A clinical specialty the engine is configured for (DENTAL, PATHOLOGY …).
 * Platform-level. Forms, workflows and stage templates hang off it, so a new
 * specialty is data, not code (lab ERD §17).
 */
@Entity({ name: 'specialties' })
export class Specialty {
  @UuidV7PrimaryColumn()
  id: string;

  /** Upper-case, stable: `DENTAL`. */
  @Column({ name: 'code', type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** New organizations get it switched on (DENTAL: yes). */
  @Column({ name: 'enabled_by_default', type: 'boolean', default: false })
  enabledByDefault: boolean;

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
