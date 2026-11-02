import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { Location } from '../../locations/entities/location.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { ConsumptionTemplate } from './consumption-template.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { PatientConsumptionItem } from './patient-consumption-item.entity';

@Entity({ name: 'patient_consumptions' })
@Index(['organizationId', 'locationId', 'createdAt'])
@Index(['patientId'])
@Index(['appointmentId'])
export class PatientConsumption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  appointmentId: string | null;

  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment | null;

  @Column({ type: 'uuid', nullable: true })
  treatmentPlanId: string | null;
  // Not a FK relation to avoid circular — just store ID for reference

  @Column({ type: 'uuid', nullable: true })
  templateId: string | null;

  @ManyToOne(() => ConsumptionTemplate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'templateId' })
  template: ConsumptionTemplate | null;
  // Which template was used as base — null if fully manual entry

  @Column()
  performedBy: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'performedBy' })
  doctor: Employee;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalCost: number;
  // SUM of all item totalPrices — calculated in service

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => PatientConsumptionItem, (item) => item.consumption, {
    cascade: true,
    eager: true,
  })
  items: PatientConsumptionItem[];
}
