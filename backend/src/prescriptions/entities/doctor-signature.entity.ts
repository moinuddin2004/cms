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
import { Organization } from 'src/organizations/entities/organization.entity';

/**
 * A doctor's saved digital signature, attached to every prescription they
 * finalize unless they explicitly draw a new one in the moment.
 *
 * Constraint: one active signature per doctor — repeat saves upsert in place
 * (uniqueness is enforced at the DB level via the [employeeId] unique index).
 *
 * `signatureImageUrl` is the durable storage URL embedded in PDFs.
 * `signatureData` keeps the raw base64 canvas data so the signature pad can
 * reload it for in-place editing without re-rendering from the image.
 */
@Entity({ name: 'doctor_signatures' })
@Index(['employeeId'], { unique: true })
export class DoctorSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Owner of the signature. Currently set to the authenticated user's UUID
   * (`req.user.uuid`). When a User→Employee mapping is added, this becomes a
   * true Employee FK again. Unique index ensures one signature per owner.
   */
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'signature_image_url', type: 'text' })
  signatureImageUrl: string;

  @Column({ name: 'signature_data', type: 'text', nullable: true })
  signatureData: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
