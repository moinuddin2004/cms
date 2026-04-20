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
import { Organization } from 'src/organizations/entities/organization.entity';
import { Employee } from './employee.entity';
import { Location } from 'src/locations/entities/location.entity';
import { EmploymentRole } from './employment-role.entity';

@Entity({ name: 'employee_location_assignments' })
@Unique(['employeeId', 'locationId'])
@Index(['employeeId', 'locationId'])
@Index(['organizationId', 'locationId'])
export class EmployeeLocationAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => EmploymentRole, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'employment_role_id' })
  employmentRole: EmploymentRole | null;

  @Column({ name: 'employment_role_id', type: 'uuid', nullable: true })
  employmentRoleId: string | null;

  @Column({ name: 'is_primary_location', type: 'boolean', default: false })
  isPrimaryLocation: boolean;

  @Column({ name: 'working_days', type: 'jsonb', nullable: true })
  workingDays: Record<string, any> | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
