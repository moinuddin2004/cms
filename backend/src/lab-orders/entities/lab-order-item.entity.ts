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
import { MinorColumn } from 'src/billing/common/minor-column';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { FormSchemaVersion } from 'src/engine/entities/form-schema-version.entity';
import { WorkflowTemplateVersion } from 'src/engine/entities/workflow-template-version.entity';
import { LabService } from 'src/lab-catalog/entities/lab-service.entity';
import { UnitType } from 'src/lab-catalog/enums/catalog.enums';
import { LabOrder } from './lab-order.entity';

/** A lab option frozen on the line at submit. */
export interface OptionSnap {
  id: string;
  code: string;
  name: string;
  extraCostMinor: number;
}

/**
 * One piece of work (lab ERD §5a): a crown, a bridge, a denture … with its
 * own price snapshot, form answers, teeth and status. The `*_snap` and
 * `*_minor` columns are frozen once the order is submitted (inv. 3) — see
 * `snapshot-freeze.ts`; only a revision or an approved charge request may
 * change them. Draft items have no status and no prices yet.
 */
@Entity({ name: 'lab_order_items' })
@Unique('uq_lab_order_items_line', ['orderId', 'lineNo'])
@Check('chk_lab_order_items_quantity', `"quantity" > 0`)
@Check(
  'chk_lab_order_items_minor',
  `"lab_unit_cost_minor" >= 0 AND "lab_line_cost_minor" >= 0 AND "patient_unit_price_minor" >= 0 AND "patient_line_price_minor" >= 0`,
)
@Index('idx_lab_order_items_order', ['orderId'])
@Index('idx_lab_order_items_org_status', ['organizationId', 'statusCode'])
@Index('idx_lab_order_items_remake', ['remakeOfItemId'])
export class LabOrderItem {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => LabOrder, (o) => o.items, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: LabOrder;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId: string;

  @Column({ name: 'line_no', type: 'int' })
  lineNo: number;

  @ManyToOne(() => LabService, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_service_id' })
  labService: LabService;

  @Column({ name: 'lab_service_id', type: 'uuid' })
  labServiceId: string;

  /** Billing `services.id` the patient is charged as (see Sprint 5 deviation 1). */
  @Column({ name: 'clinic_treatment_id', type: 'uuid', nullable: true })
  clinicTreatmentId: string | null;

  /** Chosen lab options (ids) — the draft input; frozen as `options_snap`. */
  @Column({
    name: 'option_ids',
    type: 'uuid',
    array: true,
    default: () => `'{}'`,
  })
  optionIds: string[];

  @Column({ name: 'rush', type: 'boolean', default: false })
  rush: boolean;

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity: number;

  // ── snapshot (frozen at submit) ───────────────────────────────────────

  @Column({
    name: 'service_code_snap',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  serviceCodeSnap: string | null;

  @Column({
    name: 'service_name_snap',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  serviceNameSnap: string | null;

  @Column({ name: 'unit_type', type: 'enum', enum: UnitType, nullable: true })
  unitType: UnitType | null;

  @Column({ name: 'options_snap', type: 'jsonb', nullable: true })
  optionsSnap: OptionSnap[] | null;

  /** The `lab_service_prices` row the cost came from. */
  @Column({ name: 'lab_price_id', type: 'uuid', nullable: true })
  labPriceId: string | null;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'PKR' })
  currency: string;

  @MinorColumn('lab_unit_cost_minor')
  labUnitCostMinor: number;

  @MinorColumn('lab_line_cost_minor')
  labLineCostMinor: number;

  @MinorColumn('patient_unit_price_minor')
  patientUnitPriceMinor: number;

  @MinorColumn('patient_line_price_minor')
  patientLinePriceMinor: number;

  @Column({ name: 'priced_on', type: 'date', nullable: true })
  pricedOn: string | null;

  // ── pinned definitions (never change, inv. 7) ─────────────────────────

  @ManyToOne(() => FormSchemaVersion, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'form_schema_version_id' })
  formSchemaVersion: FormSchemaVersion | null;

  /** Null when the service has no form. */
  @Column({ name: 'form_schema_version_id', type: 'uuid', nullable: true })
  formSchemaVersionId: string | null;

  @ManyToOne(() => WorkflowTemplateVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workflow_template_version_id' })
  workflowTemplateVersion: WorkflowTemplateVersion;

  @Column({ name: 'workflow_template_version_id', type: 'uuid' })
  workflowTemplateVersionId: string;

  /** Stage template of the service, copied for Sprint 8's `init_stages`. */
  @Column({ name: 'stage_template_id', type: 'uuid', nullable: true })
  stageTemplateId: string | null;

  /** Null while the order is a draft; the item workflow's state after submit. */
  @Column({ name: 'status_code', type: 'varchar', length: 50, nullable: true })
  statusCode: string | null;

  @Column({ name: 'current_stage_seq', type: 'int', nullable: true })
  currentStageSeq: number | null;

  @ManyToOne(() => LabOrderItem, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'remake_of_item_id' })
  remakeOf: LabOrderItem | null;

  @Column({ name: 'remake_of_item_id', type: 'uuid', nullable: true })
  remakeOfItemId: string | null;

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
