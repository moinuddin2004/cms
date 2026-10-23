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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
