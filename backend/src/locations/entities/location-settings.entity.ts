import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Location } from './location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';

@Entity({ name: 'location_settings' })
@Index(['locationId'], { unique: true })
export class LocationSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @Column({ name: 'location_id', type: 'uuid', unique: true })
  locationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  // ── Appointment Settings ──
  @Column({ name: 'appointment_slot_duration', type: 'int', default: 30 })
  appointmentSlotDuration: number;

  @Column({ name: 'max_appointments_per_day', type: 'int', default: 50 })
  maxAppointmentsPerDay: number;

  @Column({ name: 'advance_booking_days', type: 'int', default: 30 })
  advanceBookingDays: number;

  @Column({ name: 'cancellation_notice_hours', type: 'int', default: 24 })
  cancellationNoticeHours: number;

  // ── Reminder Settings ──
  @Column({ name: 'reminder_enabled', type: 'boolean', default: true })
  reminderEnabled: boolean;

  @Column({ name: 'reminder_days_before', type: 'int', default: 1 })
  reminderDaysBefore: number;

  @Column({ name: 'reminder_hours_before', type: 'int', default: 2 })
  reminderHoursBefore: number;

  @Column({ name: 'reminder_channels', type: 'jsonb', default: '["email"]' })
  reminderChannels: string[];

  // ── Payment Settings ──
  @Column({
    name: 'payment_gateway',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  paymentGateway: string | null;

  @Column({
    name: 'tax_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  taxRate: number;

  @Column({
    name: 'late_fee_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  lateFeePercentage: number;

  // ── Branding Settings ──
  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({
    name: 'primary_color',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  primaryColor: string | null;

  @Column({ name: 'theme', type: 'varchar', length: 20, default: 'light' })
  theme: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
