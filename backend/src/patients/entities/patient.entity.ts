import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Gender } from '../enums/gender.enum';
import { BloodGroup } from '../enums/blood-group.enum';
import { Organization } from 'src/organizations/entities/organization.entity';

@Entity({ name: 'patients' })
@Index(['patientId'], { unique: true })
@Index(['phone'], { unique: true })
@Index(['isActive'])
@Index(['fullName'])
@Index(['organizationId', 'isActive'])
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 20, unique: true })
  patientId: string;

  /**
   * Organization this patient belongs to.
   * Patients are scoped by organization — they can visit multiple locations within the same org.
   */
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /**
   * Optional FK to users table — if the patient has a login account.
   */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({ name: 'dob', type: 'date', nullable: true })
  dob: Date | null;

  @Column({
    name: 'gender',
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender: Gender | null;

  @Column({
    name: 'blood_group',
    type: 'enum',
    enum: BloodGroup,
    nullable: true,
  })
  bloodGroup: BloodGroup | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ name: 'medical_history', type: 'text', nullable: true })
  medicalHistory: string | null;

  @Column({ name: 'allergies', type: 'jsonb', default: '[]' })
  allergies: string[];

  @Column({
    name: 'emergency_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  emergencyName: string | null;

  @Column({
    name: 'emergency_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  emergencyPhone: string | null;

  @Column({
    name: 'emergency_relation',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  emergencyRelation: string | null;

  @Column({ name: 'referred_by', type: 'varchar', length: 255, nullable: true })
  referredBy: string | null;

  @Column({ name: 'occupation', type: 'varchar', length: 255, nullable: true })
  occupation: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
