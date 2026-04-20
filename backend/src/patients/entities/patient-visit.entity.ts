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
import { Patient } from './patient.entity';
import { Location } from 'src/locations/entities/location.entity';

@Entity({ name: 'patient_visits' })
@Unique(['patientId', 'locationId'])
@Index(['patientId', 'locationId'])
export class PatientVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'first_visit_date', type: 'timestamptz', nullable: true })
  firstVisitDate: Date | null;

  @Column({ name: 'last_visit_date', type: 'timestamptz', nullable: true })
  lastVisitDate: Date | null;

  @Column({ name: 'visit_count', type: 'int', default: 0 })
  visitCount: number;

  @Column({ name: 'preferred', type: 'boolean', default: false })
  preferred: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
