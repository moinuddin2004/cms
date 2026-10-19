import {
  Check,
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
import { DefinitionStatus } from '../enums/engine.enums';
import type {
  FormDefinition,
  FormUi,
  Promotions,
} from '../forms/form-definition.types';
import { FormSchema } from './form-schema.entity';

/**
 * One version of a form. Draft → published → retired. A published version
 * is immutable (a trigger rejects edits to its content and deletes), and
 * every order item pins the version it was filled in, so changing a form
 * never breaks old orders (lab ERD §3). At most one draft and one published
 * version per form; publishing a draft retires the previous published one.
 */
@Entity({ name: 'form_schema_versions' })
@Unique('uq_form_schema_versions_no', ['formSchemaId', 'versionNo'])
@Index('uq_form_schema_versions_one_draft', ['formSchemaId'], {
  unique: true,
  where: `"status" = 'draft'`,
})
@Index('uq_form_schema_versions_one_published', ['formSchemaId'], {
  unique: true,
  where: `"status" = 'published'`,
})
@Check('chk_form_schema_versions_no', `"version_no" > 0`)
@Check(
  'chk_form_schema_versions_published_at',
  `("status" = 'draft') = ("published_at" IS NULL)`,
)
export class FormSchemaVersion {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => FormSchema, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'form_schema_id' })
  formSchema: FormSchema;

  @Column({ name: 'form_schema_id', type: 'uuid' })
  formSchemaId: string;

  @Column({ name: 'version_no', type: 'int' })
  versionNo: number;

  /** `{ fields: FieldDef[] }`, normalised on save. */
  @Column({ name: 'schema_json', type: 'jsonb' })
  schemaJson: FormDefinition;

  /** Layout (sections, tooth-chart widget settings). */
  @Column({ name: 'ui_json', type: 'jsonb', nullable: true })
  uiJson: FormUi | null;

  /** Field key → `table.column` the answer is copied into. */
  @Column({ name: 'promotions', type: 'jsonb', default: () => `'{}'::jsonb` })
  promotions: Promotions;

  @Column({
    name: 'status',
    type: 'enum',
    enum: DefinitionStatus,
    default: DefinitionStatus.DRAFT,
  })
  status: DefinitionStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;

  @Column({ name: 'retired_at', type: 'timestamptz', nullable: true })
  retiredAt: Date | null;

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
