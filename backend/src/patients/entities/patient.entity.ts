import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  OneToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Gender } from '../enums/gender.enum';
import { BloodGroup } from '../enums/blood-group.enum';
import { MaritalStatus } from '../enums/marital-status.enum';
import { Language } from '../enums/language.enum';
import { CommunicationPreference } from '../enums/communication-preference.enum';
import { PatientSource } from '../enums/patient-source.enum';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { PatientDentalInfo } from './patient-dental-info.entity';
import { PatientVisit } from './patient-visit.entity';
import { PatientTeethChart } from './patient-teeth-chart.entity';
import { PatientVitals } from './patient-vitals.entity';
import { PatientTreatmentPlan } from './patient-treatment-plan.entity';
import { PatientPrescription } from './patient-prescription.entity';
import { PatientDocument } from './patient-document.entity';
import { PatientConsent } from './patient-consent.entity';
import { PatientCommunication } from './patient-communication.entity';
import { PatientRecall } from './patient-recall.entity';
import { PatientReferral } from './patient-referral.entity';
import { PatientFeedback } from './patient-feedback.entity';
import { PatientInsurance } from './patient-insurance.entity';

@Entity({ name: 'patients' })
@Index(['organizationId', 'patientNumber'], { unique: true })
@Index(['organizationId', 'isActive'])
@Index(['phone'])
@Index(['fullName'])
@Index(['cnic'])
@Index(['primaryLocationId'])
@Index(['organizationId', 'isBlacklisted'])
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'patient_number', type: 'varchar', length: 20 })
  patientNumber: string;

  // ─── Demographics ───────────────────────────────────────
  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({ name: 'dob', type: 'date', nullable: true })
  dob: Date | null;

  @Column({ name: 'gender', type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ name: 'blood_group', type: 'enum', enum: BloodGroup, nullable: true })
  bloodGroup: BloodGroup | null;

  @Column({ name: 'marital_status', type: 'enum', enum: MaritalStatus, nullable: true })
  maritalStatus: MaritalStatus | null;

  @Column({ name: 'occupation', type: 'varchar', length: 100, nullable: true })
  occupation: string | null;

  @Column({ name: 'cnic', type: 'varchar', length: 15, nullable: true })
  cnic: string | null;

  // ─── Contact ────────────────────────────────────────────
  @Column({ name: 'phone', type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'whatsapp_number', type: 'varchar', length: 20, nullable: true })
  whatsappNumber: string | null;

  @Column({ name: 'email', type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city: string | null;

  // ─── Preferences ────────────────────────────────────────
  @Column({ name: 'preferred_language', type: 'enum', enum: Language, default: Language.URDU })
  preferredLanguage: Language;

  @Column({ name: 'communication_pref', type: 'enum', enum: CommunicationPreference, default: CommunicationPreference.WHATSAPP })
  communicationPref: CommunicationPreference;

  // ─── Clinic Relationship ────────────────────────────────
  @ManyToOne(() => Location, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'primary_location_id' })
  primaryLocation: Location;

  @Column({ name: 'primary_location_id', type: 'uuid', nullable: true })
  primaryLocationId: string | null;

  @Column({ name: 'source', type: 'enum', enum: PatientSource, default: PatientSource.WALK_IN })
  source: PatientSource;

  @Column({ name: 'referred_by_text', type: 'varchar', length: 200, nullable: true })
  referredByText: string | null;

  // ─── Profile ────────────────────────────────────────────
  @Column({ name: 'profile_picture_url', type: 'text', nullable: true })
  profilePictureUrl: string | null;

  // ─── Minor / Guardian ──────────────────────────────────
  @Column({ name: 'is_minor', type: 'boolean', default: false })
  isMinor: boolean;

  @Column({ name: 'guardian_name', type: 'varchar', length: 150, nullable: true })
  guardianName: string | null;

  @Column({ name: 'guardian_phone', type: 'varchar', length: 20, nullable: true })
  guardianPhone: string | null;

  @Column({ name: 'guardian_relation', type: 'varchar', length: 50, nullable: true })
  guardianRelation: string | null;

  // ─── Medical (quick-access) ─────────────────────────────
  @Column({ name: 'medical_history', type: 'text', nullable: true })
  medicalHistory: string | null;

  @Column({ name: 'allergies', type: 'text', nullable: true })
  allergies: string | null;

  @Column({ name: 'emergency_contact_name', type: 'varchar', length: 150, nullable: true })
  emergencyContactName: string | null;

  @Column({ name: 'emergency_contact_phone', type: 'varchar', length: 20, nullable: true })
  emergencyContactPhone: string | null;

  @Column({ name: 'emergency_contact_relation', type: 'varchar', length: 50, nullable: true })
  emergencyContactRelation: string | null;

  // ─── Internal Admin ─────────────────────────────────────
  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes: string | null;

  @Column({ name: 'tags', type: 'jsonb', default: '[]' })
  tags: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_blacklisted', type: 'boolean', default: false })
  isBlacklisted: boolean;

  @Column({ name: 'blacklist_reason', type: 'text', nullable: true })
  blacklistReason: string | null;

  // ─── Patient Portal ─────────────────────────────────────
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  // ─── Audit ──────────────────────────────────────────────
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date | null;

  // ─── Relations ──────────────────────────────────────────
  @OneToOne(() => PatientDentalInfo, (d) => d.patient)
  dentalInfo: PatientDentalInfo;

  @OneToMany(() => PatientVisit, (v) => v.patient)
  visits: PatientVisit[];

  @OneToMany(() => PatientTeethChart, (c) => c.patient)
  teethCharts: PatientTeethChart[];

  @OneToMany(() => PatientVitals, (v) => v.patient)
  vitals: PatientVitals[];

  @OneToMany(() => PatientTreatmentPlan, (tp) => tp.patient)
  treatmentPlans: PatientTreatmentPlan[];

  @OneToMany(() => PatientPrescription, (rx) => rx.patient)
  prescriptions: PatientPrescription[];

  @OneToMany(() => PatientDocument, (d) => d.patient)
  documents: PatientDocument[];

  @OneToMany(() => PatientConsent, (c) => c.patient)
  consents: PatientConsent[];

  @OneToMany(() => PatientCommunication, (c) => c.patient)
  communications: PatientCommunication[];

  @OneToMany(() => PatientRecall, (r) => r.patient)
  recalls: PatientRecall[];

  @OneToMany(() => PatientReferral, (r) => r.referringPatient)
  referralsMade: PatientReferral[];

  @OneToMany(() => PatientFeedback, (f) => f.patient)
  feedback: PatientFeedback[];

  @OneToMany(() => PatientInsurance, (i) => i.patient)
  insurance: PatientInsurance[];
}
