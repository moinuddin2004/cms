import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Employee } from 'src/employees/entities/employee.entity';
import { Specialty } from 'src/engine/entities/specialty.entity';
import { WorkflowTemplateVersion } from 'src/engine/entities/workflow-template-version.entity';
import { LabClinicLink } from 'src/labs/entities/lab-clinic-link.entity';
import { Lab } from 'src/labs/entities/lab.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Patient } from 'src/patients/entities/patient.entity';
import { OrderPriority } from '../enums/order.enums';
import { LabOrderItem } from './lab-order-item.entity';

/**
 * A lab case (lab ERD §5a): a container of items for one patient, one
 * doctor and one lab. `status_code` follows the order workflow version
 * pinned at create (never changes, inv. 7) and moves only through
 * `WorkflowEngine.transition()` / derivation from the items (§9c).
 * `order_no` is given at submit — drafts have none.
 */
@Entity({ name: 'lab_orders' })
@Unique('uq_lab_orders_org_no', ['organizationId', 'orderNo'])
@Unique('uq_lab_orders_org_idempotency', ['organizationId', 'idempotencyKey'])
@Index('idx_lab_orders_org_status_due', [
  'organizationId',
  'statusCode',
  'labExpectedOn',
])
@Index('idx_lab_orders_lab_queue', ['labId', 'statusCode', 'submittedAt'])
@Index('idx_lab_orders_patient', ['patientId', 'createdAt'])
export class LabOrder {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Location, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  /** `LAB-0001`, from `number_sequences` at submit. */
  @Column({ name: 'order_no', type: 'varchar', length: 30, nullable: true })
  orderNo: string | null;

  @ManyToOne(() => Specialty, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'specialty_id' })
  specialty: Specialty;

  @Column({ name: 'specialty_id', type: 'uuid' })
  specialtyId: string;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  /** The ordering doctor (employee, like `appointments.doctor_id`). Required at submit. */
  @ManyToOne(() => Employee, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Employee | null;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  @ManyToOne(() => Lab, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId: string;

  @ManyToOne(() => LabClinicLink, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_clinic_link_id' })
  labClinicLink: LabClinicLink;

  @Column({ name: 'lab_clinic_link_id', type: 'uuid' })
  labClinicLinkId: string;

  @ManyToOne(() => WorkflowTemplateVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workflow_template_version_id' })
  workflowTemplateVersion: WorkflowTemplateVersion;

  /** Pinned at create; never changes (lab ERD inv. 7). */
  @Column({ name: 'workflow_template_version_id', type: 'uuid' })
  workflowTemplateVersionId: string;

  @Column({ name: 'status_code', type: 'varchar', length: 50 })
  statusCode: string;

  @Column({
    name: 'priority',
    type: 'enum',
    enum: OrderPriority,
    default: OrderPriority.NORMAL,
  })
  priority: OrderPriority;

  /** The day the clinic wants the work back (optional). */
  @Column({ name: 'requested_on', type: 'date', nullable: true })
  requestedOn: string | null;

  /**
   * When the work is expected back. Estimated at submit (requested day, or
   * submit day + the longest turnaround); the lab sets it on accept.
   */
  @Column({ name: 'lab_expected_on', type: 'date', nullable: true })
  labExpectedOn: string | null;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  /** The patient's treatment record this case belongs to (optional). */
  @Column({ name: 'treatment_id', type: 'uuid', nullable: true })
  treatmentId: string | null;

  /** The order template the draft started from (counted at submit). */
  @Column({ name: 'order_template_id', type: 'uuid', nullable: true })
  orderTemplateId: string | null;

  /** Instructions for the whole case. */
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  /** 0 for drafts; 1 at submit; +1 per revision. */
  @Column({ name: 'current_revision_no', type: 'int', default: 0 })
  currentRevisionNo: number;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  /** Idempotency-Key of the create request: the same key → the same draft. */
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  idempotencyKey: string | null;

  @OneToMany(() => LabOrderItem, (i) => i.order)
  items: LabOrderItem[];

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
