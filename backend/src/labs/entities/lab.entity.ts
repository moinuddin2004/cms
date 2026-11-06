import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Organization } from 'src/organizations/entities/organization.entity';
import { LabStatus, LabType } from '../enums/lab.enums';

/**
 * A dental lab — platform-level (no tenant column): one lab works with many
 * clinics through `lab_clinic_links`, so it never needs a login per clinic.
 * An internal lab belongs to one clinic organization (`owner_organization_id`).
 */
@Entity({ name: 'labs' })
@Check(
  'chk_labs_owner',
  `("lab_type" = 'internal') = ("owner_organization_id" IS NOT NULL)`,
)
@Index('idx_labs_status_name', ['status', 'name'])
@Index('idx_labs_owner', ['ownerOrganizationId'])
export class Lab {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'lab_type', type: 'enum', enum: LabType })
  labType: LabType;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_organization_id' })
  ownerOrganization: Organization | null;

  @Column({ name: 'owner_organization_id', type: 'uuid', nullable: true })
  ownerOrganizationId: string | null;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({
    name: 'whatsapp_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  whatsappPhone: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  /**
   * The contact address was confirmed (link clicked, or a super admin marked
   * it). Email — order links included — goes only to a verified address.
   * Cleared whenever `email` changes.
   */
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  /** sha256 of the pending confirmation token (never the raw token). */
  @Column({
    name: 'email_verify_token',
    type: 'varchar',
    length: 64,
    nullable: true,
    select: false,
  })
  emailVerifyToken: string | null;

  @Column({
    name: 'email_verify_expires',
    type: 'timestamptz',
    nullable: true,
    select: false,
  })
  emailVerifyExpires: Date | null;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city: string | null;

  /** Pickup / delivery address for couriers (not in the ERD; needed by shipments). */
  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: LabStatus,
    default: LabStatus.ACTIVE,
  })
  status: LabStatus;

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
