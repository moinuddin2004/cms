import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { EmploymentRole } from './employment-role.entity';
import { User } from 'src/user/entities/user.entity';
import { EmploymentType } from '../enums/employee.enums';

@Entity({ name: 'employee_org_location_assignments' })
@Unique(['employeeId', 'locationId'])
@Unique(['organizationId', 'employeeCode'])
@Index(['employeeId', 'organizationId'])
@Index(['locationId', 'isActive'])
@Index(['userId'])
@Index(['employeeId', 'hasPortalAccess'])
export class EmployeeOrgLocationAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, (e) => e.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  // Role at this location
  @ManyToOne(() => EmploymentRole, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'employment_role_id' })
  employmentRole: EmploymentRole | null;

  @Column({ name: 'employment_role_id', type: 'uuid', nullable: true })
  employmentRoleId: string | null;

  @Column({ name: 'designation', type: 'varchar', length: 100 })
  designation: string;

  /**
   * Queue token prefix for this doctor at this location ("A" → "A-007").
   * Empty = first letter of the doctor's name.
   */
  @Column({ name: 'token_prefix', type: 'varchar', length: 6, nullable: true })
  tokenPrefix: string | null;

  @Column({
    name: 'employment_type',
    type: 'enum',
    enum: EmploymentType,
    default: EmploymentType.FULL_TIME,
  })
  employmentType: EmploymentType;

  @Column({ name: 'employee_code', type: 'varchar', length: 20 })
  employeeCode: string;

  @Column({ name: 'joining_date', type: 'date' })
  joiningDate: Date;

  /**
   * @deprecated Salary now lives in `compensation_plans` (versioned). Kept
   * for old rows only and no longer written once a plan exists.
   */
  @Column({
    name: 'gross_salary',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  grossSalary: number | null;

  // Portal access PER LOCATION
  @Column({ name: 'has_portal_access', type: 'boolean', default: false })
  hasPortalAccess: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
