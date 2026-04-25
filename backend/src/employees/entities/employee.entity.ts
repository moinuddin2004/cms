import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Gender } from '../enums/employee.enums';
import { EmployeeOrgLocationAssignment } from './employee-org-location-assignment.entity';
import { EmployeeSchedule } from './employee-schedule.entity';

@Entity({ name: 'employees' })
@Index(['phone'])
@Index(['cnic'])
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({
    name: 'cnic',
    type: 'varchar',
    length: 20,
    nullable: true,
    unique: true,
  })
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

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => EmployeeOrgLocationAssignment, (a) => a.employee)
  assignments: EmployeeOrgLocationAssignment[];

  @OneToMany(() => EmployeeSchedule, (s) => s.employee)
  schedules: EmployeeSchedule[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
