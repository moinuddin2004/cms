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
import { ConsentType } from '../enums/consent-type.enum';

/**
 * IMMUTABLE entity — no UPDATE or DELETE operations allowed.
 * If consent is revoked, a new row with is_agreed = false is inserted.
 */
@Entity({ name: 'patient_consents' })
@Index(['patientId'])
@Index(['organizationId'])
@Index(['consentType'])
@Index(['appointmentId'])
export class PatientConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (p) => p.consents, { onDelete: 'CASCADE' })
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

  @Column({ name: 'consent_type', type: 'enum', enum: ConsentType })
  consentType: ConsentType;

  @Column({ name: 'consent_version', type: 'varchar', length: 20, default: '1.0' })
  consentVersion: string;

  @Column({ name: 'consent_text', type: 'text' })
  consentText: string;

  @Column({ name: 'is_agreed', type: 'boolean' })
  isAgreed: boolean;

  @Column({ name: 'agreed_at', type: 'timestamptz', default: () => 'NOW()' })
  agreedAt: Date;

  @Column({ name: 'signed_by_name', type: 'varchar', length: 150 })
  signedByName: string;

  @Column({ name: 'signed_by_type', type: 'varchar', length: 20, default: 'patient' })
  signedByType: string;

  @Column({ name: 'witnessed_by', type: 'uuid', nullable: true })
  witnessedBy: string | null;

  @Column({ name: 'signature_url', type: 'text', nullable: true })
  signatureUrl: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
