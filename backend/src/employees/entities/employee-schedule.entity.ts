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
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';

@Entity({ name: 'employee_schedules' })
@Unique(['employeeId', 'locationId', 'dayOfWeek'])
@Index(['employeeId', 'locationId'])
@Index(['locationId', 'dayOfWeek'])
export class EmployeeSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, (e) => e.schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'day_of_week', type: 'int' })
  dayOfWeek: number; // 0=Sunday, 1=Monday ... 6=Saturday

  @Column({ name: 'is_working', type: 'boolean', default: true })
  isWorking: boolean;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime: string | null; // "09:00" | null if not working

  @Column({ name: 'end_time', type: 'time', nullable: true })
  endTime: string | null; // "17:00" | null if not working

  @Column({ name: 'slot_duration', type: 'int', default: 30 })
  slotDuration: number; // 15 | 30 | 45 | 60

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
