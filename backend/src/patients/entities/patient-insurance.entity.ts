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
import { Patient } from './patient.entity';
import { Organization } from 'src/organizations/entities/organization.entity';

@Entity({ name: 'patient_insurance' })
@Index(['patientId'])
@Index(['organizationId'])
@Index(['patientId', 'isActive'])
export class PatientInsurance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (p) => p.insurance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'provider_name', type: 'varchar', length: 150 })
  providerName: string;

  @Column({ name: 'plan_name', type: 'varchar', length: 150, nullable: true })
  planName: string | null;

  @Column({ name: 'policy_number', type: 'varchar', length: 100 })
  policyNumber: string;

  @Column({ name: 'policy_holder_name', type: 'varchar', length: 150, nullable: true })
  policyHolderName: string | null;

  @Column({ name: 'group_number', type: 'varchar', length: 100, nullable: true })
  groupNumber: string | null;

  @Column({ name: 'coverage_details', type: 'text', nullable: true })
  coverageDetails: string | null;

  @Column({ name: 'coverage_percentage', type: 'int', default: 0 })
  coveragePercentage: number;

  @Column({ name: 'max_annual_benefit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxAnnualBenefit: number | null;

  @Column({ name: 'used_benefit', type: 'decimal', precision: 12, scale: 2, default: 0 })
  usedBenefit: number;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'card_front_url', type: 'text', nullable: true })
  cardFrontUrl: string | null;

  @Column({ name: 'card_back_url', type: 'text', nullable: true })
  cardBackUrl: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
