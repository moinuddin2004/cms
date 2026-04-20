import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { CommType } from '../enums/comm-type.enum';
import { CommDirection } from '../enums/comm-direction.enum';
import { CommStatus } from '../enums/comm-status.enum';
import { CommPurpose } from '../enums/comm-purpose.enum';

@Entity({ name: 'patient_communications' })
@Index(['patientId'])
@Index(['organizationId'])
@Index(['type'])
@Index(['sentAt'])
@Index(['status'])
export class PatientCommunication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (p) => p.communications, { onDelete: 'CASCADE' })
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

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  @Column({ name: 'type', type: 'enum', enum: CommType })
  type: CommType;

  @Column({ name: 'direction', type: 'enum', enum: CommDirection })
  direction: CommDirection;

  @Column({ name: 'purpose', type: 'enum', enum: CommPurpose, default: CommPurpose.GENERAL })
  purpose: CommPurpose;

  @Column({ name: 'subject', type: 'varchar', length: 300, nullable: true })
  subject: string | null;

  @Column({ name: 'message_body', type: 'text', nullable: true })
  messageBody: string | null;

  @Column({ name: 'status', type: 'enum', enum: CommStatus, default: CommStatus.PENDING })
  status: CommStatus;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'sent_by', type: 'uuid', nullable: true })
  sentBy: string | null;

  @Column({ name: 'is_automated', type: 'boolean', default: false })
  isAutomated: boolean;

  @Column({ name: 'automation_trigger', type: 'varchar', length: 100, nullable: true })
  automationTrigger: string | null;

  @Column({ name: 'external_message_id', type: 'varchar', length: 200, nullable: true })
  externalMessageId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
