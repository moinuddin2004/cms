import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Patient } from 'src/patients/entities/patient.entity';
import { ALL_LANGUAGES, NotificationLanguage } from '../notifications.enums';
import { sqlList } from './sql-list';

/** A patient's messaging opt-outs and language (decision order step 4). */
@Entity({ name: 'patient_comm_prefs' })
@Index('idx_patient_comm_prefs_org', ['organizationId'])
@Check(
  'chk_patient_comm_prefs_language',
  `"preferred_language" IS NULL OR "preferred_language" IN (${sqlList(ALL_LANGUAGES)})`,
)
export class PatientCommPref {
  @PrimaryColumn({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @OneToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'whatsapp_opt_out', type: 'boolean', default: false })
  whatsappOptOut: boolean;

  @Column({ name: 'sms_opt_out', type: 'boolean', default: false })
  smsOptOut: boolean;

  @Column({ name: 'email_opt_out', type: 'boolean', default: false })
  emailOptOut: boolean;

  @Column({ name: 'preferred_language', type: 'text', nullable: true })
  preferredLanguage: NotificationLanguage | null;

  /** Last time any opt-out was switched on. */
  @Column({ name: 'opted_out_at', type: 'timestamptz', nullable: true })
  optedOutAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}
