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
import { ReferralStatus } from '../enums/referral-status.enum';

@Entity({ name: 'patient_referrals' })
@Index(['organizationId'])
@Index(['referringPatientId'])
@Index(['referredPatientId'])
@Index(['status'])
export class PatientReferral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Patient, (p) => p.referralsMade, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'referring_patient_id' })
  referringPatient: Patient;

  @Column({ name: 'referring_patient_id', type: 'uuid' })
  referringPatientId: string;

  @ManyToOne(() => Patient, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'referred_patient_id' })
  referredPatient: Patient | null;

  @Column({ name: 'referred_patient_id', type: 'uuid', nullable: true })
  referredPatientId: string | null;

  @Column({ name: 'referred_name', type: 'varchar', length: 150, nullable: true })
  referredName: string | null;

  @Column({ name: 'referred_phone', type: 'varchar', length: 20, nullable: true })
  referredPhone: string | null;

  @Column({ name: 'referral_date', type: 'date', default: () => 'CURRENT_DATE' })
  referralDate: Date;

  @Column({ name: 'reward_given', type: 'boolean', default: false })
  rewardGiven: boolean;

  @Column({ name: 'reward_amount', type: 'decimal', precision: 8, scale: 2, nullable: true })
  rewardAmount: number | null;

  @Column({ name: 'reward_type', type: 'varchar', length: 50, nullable: true })
  rewardType: string | null;

  @Column({ name: 'reward_given_at', type: 'timestamptz', nullable: true })
  rewardGivenAt: Date | null;

  @Column({ name: 'status', type: 'enum', enum: ReferralStatus, default: ReferralStatus.PENDING })
  status: ReferralStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
