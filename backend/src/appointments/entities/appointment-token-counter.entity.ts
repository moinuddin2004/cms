import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Atomic per-(org, location, day) token counter. One row per location per
 * calendar day; `lastNumber` is bumped via an atomic
 * `INSERT … ON CONFLICT … DO UPDATE … RETURNING` so concurrent check-ins at a
 * busy reception desk can never collide on a token number.
 *
 * `day` is the location's local date as a plain "YYYY-MM-DD" string (passed in
 * by the caller), avoiding server/location timezone drift.
 */
@Entity({ name: 'appointment_token_counters' })
@Index(['organizationId', 'locationId', 'day'], { unique: true })
export class AppointmentTokenCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @Column({ name: 'day', type: 'date' })
  day: string;

  @Column({ name: 'last_number', type: 'int', default: 0 })
  lastNumber: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
