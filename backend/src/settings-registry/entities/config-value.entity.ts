import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';

export enum ConfigScope {
  PLATFORM = 'platform',
  ORG = 'org',
  LOCATION = 'location',
}

/**
 * One value of a registry setting (see `defineSetting`) at one scope.
 *
 * `value` null = nothing set here (the scope inherits), which lets a row
 * carry only a lock: `is_locked` freezes the effective value at this scope
 * so lower scopes can't override it.
 *
 * Postgres treats NULLs as distinct in unique indexes, so platform rows
 * (`scope_id` null) get their own partial unique index on `key`.
 */
@Entity({ name: 'config_values' })
@Index('uq_config_values_scope_key', ['scopeType', 'scopeId', 'key'], {
  unique: true,
})
@Index('uq_config_values_platform_key', ['key'], {
  unique: true,
  where: `"scope_type" = 'platform'`,
})
export class ConfigValue {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'scope_type', type: 'enum', enum: ConfigScope })
  scopeType: ConfigScope;

  /** Organization or location id; null for platform. */
  @Column({ name: 'scope_id', type: 'uuid', nullable: true })
  scopeId: string | null;

  @Column({ name: 'key', type: 'varchar', length: 100 })
  key: string;

  @Column({ name: 'value', type: 'jsonb', nullable: true })
  value: unknown;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  /** Bumped on every write. */
  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
