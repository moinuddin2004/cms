import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  Check,
} from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import { User } from 'src/user/entities/user.entity';

@Entity({ name: 'employees' })
@Unique(['organizationId', 'employeeCode'])
@Index(['organizationId', 'isActive'])
@Index(['userId'])
@Check(
  `("has_portal_access" = true AND "user_id" IS NOT NULL) OR ("has_portal_access" = false AND "user_id" IS NULL)`,
)
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({
    name: 'employee_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  employeeCode: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email: string | null;

  // ── Portal Access ──
  @Column({ name: 'has_portal_access', type: 'boolean', default: false })
  hasPortalAccess: boolean;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  // ── Employment Info ──
  @Column({ name: 'designation', type: 'varchar', length: 100, nullable: true })
  designation: string | null;

  @Column({
    name: 'specialization',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  specialization: string | null;

  @Column({ name: 'experience_years', type: 'int', nullable: true })
  experienceYears: number | null;

  @Column({ name: 'joining_date', type: 'date', nullable: true })
  joiningDate: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
