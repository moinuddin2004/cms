import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';

@Entity({ name: 'patient_teeth_chart' })
@Index(['patientId'])
@Index(['organizationId'])
@Index(['recordedAt'])
export class PatientTeethChart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (p) => p.teethCharts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'dentist_id', type: 'uuid' })
  dentistId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string | null;

  /**
   * FDI notation chart data keyed by tooth (11–48 permanent, 51–85 primary):
   * { "16": { condition?: CROWN|IMPLANT|EXTRACTION_NEEDED|MISSING, planned?,
   *   rootCanal?: { planned? }, surfaces?: { M|O|I|D|B|L: { condition:
   *   CARIES|FILLED, planned? } }, note? } }. Older rows may hold a bare
   * condition string or { condition } — the web app normalises both.
   */
  @Column({ name: 'chart_data', type: 'jsonb', default: '{}' })
  chartData: Record<string, any>;

  @Column({ name: 'periodontal_chart', type: 'jsonb', nullable: true })
  periodontalChart: Record<string, any> | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'is_initial_chart', type: 'boolean', default: false })
  isInitialChart: boolean;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'NOW()' })
  recordedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
