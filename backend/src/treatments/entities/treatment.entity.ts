import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { VisibleIf } from 'src/access/visible-if/visible-if';
import { Patient } from 'src/patients/entities/patient.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { PatientEncounter } from 'src/encounters/entities/patient-encounter.entity';
import { PlanTemplate } from 'src/plan-templates/entities/plan-template.entity';

/**
 * A treatment that was actually performed/rendered. ALWAYS belongs to a patient
 * (never orphaned); optionally linked to the encounter it was carried out in.
 * This is distinct from PatientTreatmentPlan / TreatmentPlanItem, which model a
 * *planned* course of procedures with consent and cost estimates.
 */
@Entity({ name: 'treatments' })
@Index(['organizationId'])
@Index(['locationId'])
@Index(['patientId'])
@Index(['encounterId'])
export class Treatment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── Patient (required — never orphaned) ──────────────────────
  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  // ─── Encounter (optional — doctor's discretion) ───────────────
  @ManyToOne(() => PatientEncounter, (e) => e.treatments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'encounter_id' })
  encounter: PatientEncounter | null;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId: string | null;

  // ─── Plan (optional — the clinic's plan this treatment follows) ──
  @ManyToOne(() => PlanTemplate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'plan_template_id' })
  planTemplate: PlanTemplate | null;

  @Column({ name: 'plan_template_id', type: 'uuid', nullable: true })
  planTemplateId: string | null;

  // ─── Tenancy ──────────────────────────────────────────────────
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  // ─── Details ──────────────────────────────────────────────────
  @Column({ name: 'treatment_name', type: 'varchar', length: 200 })
  treatmentName: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  /** Legacy fee; billing falls back to it only when no service is set. */
  @VisibleIf('patients.price.view')
  @Column({
    name: 'cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  cost: number | null;

  /**
   * Set when this is a session of a treatment-plan step. The plan's invoice
   * already covers it, so visit billing skips it.
   */
  @Column({ name: 'plan_item_id', type: 'uuid', nullable: true })
  planItemId: string | null;

  /** Catalog service (kind PROCEDURE) — billing prices the charge from it. */
  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @Column({ name: 'date', type: 'timestamptz' })
  date: Date;

  // ─── Audit ────────────────────────────────────────────────────
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
