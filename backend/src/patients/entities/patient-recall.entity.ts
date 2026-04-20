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
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { RecallType } from '../enums/recall-type.enum';
import { RecallStatus } from '../enums/recall-status.enum';

@Entity({ name: 'patient_recalls' })
@Index(['patientId'])
@Index(['organizationId'])
@Index(['dueDate'])
@Index(['status'])
export class PatientRecall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (p) => p.recalls, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'dentist_id', type: 'uuid', nullable: true })
  dentistId: string | null;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'recall_type', type: 'enum', enum: RecallType })
  recallType: RecallType;

  @Column({ name: 'custom_name', type: 'varchar', length: 200, nullable: true })
  customName: string | null;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ name: 'first_reminder_sent_at', type: 'timestamptz', nullable: true })
  firstReminderSentAt: Date | null;

  @Column({ name: 'second_reminder_sent_at', type: 'timestamptz', nullable: true })
  secondReminderSentAt: Date | null;

  @Column({ name: 'third_reminder_sent_at', type: 'timestamptz', nullable: true })
  thirdReminderSentAt: Date | null;

  @Column({ name: 'status', type: 'enum', enum: RecallStatus, default: RecallStatus.SCHEDULED })
  status: RecallStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
