import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from './organization.entity';

@Entity({ name: 'organization_settings' })
@Index(['organizationId'], { unique: true })
export class OrganizationSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid', unique: true })
  organizationId: string;

  // ── Feature Flags ──
  @Column({ name: 'feature_appointments', type: 'boolean', default: true })
  featureAppointments: boolean;

  @Column({ name: 'feature_inventory', type: 'boolean', default: true })
  featureInventory: boolean;

  @Column({ name: 'feature_finance', type: 'boolean', default: true })
  featureFinance: boolean;

  @Column({ name: 'feature_reminders', type: 'boolean', default: true })
  featureReminders: boolean;

  @Column({ name: 'feature_whatsapp', type: 'boolean', default: false })
  featureWhatsapp: boolean;

  @Column({ name: 'feature_patient_portal', type: 'boolean', default: false })
  featurePatientPortal: boolean;

  // ── Override Settings ──
  @Column({ name: 'allow_location_override', type: 'boolean', default: true })
  allowLocationOverride: boolean;

  // ── Defaults ──
  @Column({ name: 'default_slot_duration', type: 'int', default: 30 })
  defaultSlotDuration: number;

  @Column({ name: 'advance_booking_days', type: 'int', default: 30 })
  advanceBookingDays: number;

  @Column({ name: 'cancellation_notice_hours', type: 'int', default: 24 })
  cancellationNoticeHours: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
