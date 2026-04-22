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
  OneToMany,
} from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import { User } from 'src/user/entities/user.entity';
import { EmploymentRole } from './employment-role.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Gender, EmploymentType } from '../enums/employee.enums';

@Entity({ name: 'employees' })
@Unique(['organizationId', 'employeeCode'])
@Index(['organizationId', 'isActive'])
@Index(['primaryLocationId'])
@Index(['employeeCode'])
@Index(['phone'])
@Index(['userId'])
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'employee_code', type: 'varchar', length: 20 })
  employeeCode: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ name: 'phone', type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'cnic', type: 'varchar', length: 20, nullable: true })
  cnic: string | null;

  @Column({
    name: 'gender',
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender: Gender | null;

  @Column({ name: 'dob', type: 'date', nullable: true })
  dob: Date | null;

  @Column({
    name: 'profile_picture_url',
    type: 'varchar',
    nullable: true,
  })
  profilePictureUrl: string | null;

  @Column({ name: 'designation', type: 'varchar', length: 100 })
  designation: string;

  @ManyToOne(() => EmploymentRole, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'employment_role_id' })
  employmentRole: EmploymentRole | null;

  @Column({ name: 'employment_role_id', type: 'uuid' })
  employmentRoleId: string;

  @Column({
    name: 'employment_type',
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @Column({ name: 'joining_date', type: 'date' })
  joiningDate: Date;

  @ManyToOne(() => Location, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'primary_location_id' })
  primaryLocation: Location | null;

  @Column({ name: 'primary_location_id', type: 'uuid' })
  primaryLocationId: string;

  // ── Portal Access ──
  @Column({ name: 'has_portal_access', type: 'boolean', default: false })
  hasPortalAccess: boolean;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
