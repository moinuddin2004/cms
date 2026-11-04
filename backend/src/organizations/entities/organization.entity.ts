import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { SubscriptionPlan } from 'src/common/enums/subscription-plan.enum';
import { ClinicApprovalStatus } from 'src/common/enums/clinic-approval-status.enum';

@Entity({ name: 'organizations' })
@Index(['slug'], { unique: true })
@Index(['isActive'])
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'slug', type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'website', type: 'varchar', length: 500, nullable: true })
  website: string | null;

  @Column({
    name: 'subscription_plan',
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  subscriptionPlan: SubscriptionPlan;

  @Column({ name: 'clinic_type', type: 'varchar', length: 100, nullable: true })
  clinicType: string | null;

  /** Clinic specialties for feature relevance: general, dental, skin, ortho, physio, eye */
  @Column({ name: 'specialty_tags', type: 'jsonb', default: '["general"]' })
  specialtyTags: string[];

  @Column({
    name: 'timezone',
    type: 'varchar',
    length: 100,
    default: 'Asia/Karachi',
  })
  timezone: string;

  @Column({ name: 'currency', type: 'varchar', length: 10, default: 'PKR' })
  currency: string;

  @Column({ name: 'max_locations', type: 'int', nullable: true })
  maxLocations: number | null;

  @Column({ name: 'max_users', type: 'int', nullable: true })
  maxUsers: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Subscription (see src/subscriptions). Both null = an unmanaged clinic
   * (created by a super admin before subscriptions existed): no expiry and
   * no plan limits. Self-signup sets `trialEndsAt`; recording a payment
   * moves `paidUntil` forward.
   */
  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  @Column({ name: 'paid_until', type: 'timestamptz', nullable: true })
  paidUntil: Date | null;

  /** Self-signup clinics go through the setup wizard once (`/setup`). */
  @Column({ name: 'onboarding_pending', type: 'boolean', default: false })
  onboardingPending: boolean;

  /**
   * Super admin approval. Self-signups start `pending` and every tenant
   * request is refused until approved (TenantContextGuard → ClinicGate).
   * The default keeps existing and super-admin-created clinics usable.
   */
  @Column({
    name: 'approval_status',
    type: 'enum',
    enum: ClinicApprovalStatus,
    default: ClinicApprovalStatus.APPROVED,
  })
  approvalStatus: ClinicApprovalStatus;

  @Column({ name: 'approval_decided_at', type: 'timestamptz', nullable: true })
  approvalDecidedAt: Date | null;

  @Column({ name: 'approval_decided_by', type: 'uuid', nullable: true })
  approvalDecidedBy: string | null;

  /** Why a clinic was rejected — shown to its owner. */
  @Column({ name: 'approval_note', type: 'text', nullable: true })
  approvalNote: string | null;

  /**
   * +1 on every access change in the org (roles, assignments, feature
   * flags, ownership); access caches key on it. Written only by
   * AccessVersionService (raw SQL) — never by entity saves, which would
   * write back a stale value.
   */
  @Column({
    name: 'access_version',
    type: 'int',
    default: 1,
    insert: false,
    update: false,
  })
  accessVersion: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
