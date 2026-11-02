import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { MinorColumn } from 'src/billing/common/minor-column';
import { Organization } from 'src/organizations/entities/organization.entity';
import { LabService } from './lab-service.entity';

/**
 * A lab's price for a service over [effective_from, effective_to]
 * (inclusive; null `effective_to` = open-ended). `organization_id` null is
 * the lab's list price; set, it is that clinic's negotiated price, which
 * wins over the list price (lab ERD §4). Windows of one (service, clinic)
 * never overlap — exclusion constraint; a null clinic is folded into the
 * nil uuid so list prices are covered too. Rows are never deleted: a
 * running price is ended, a future one may be voided.
 */
@Entity({ name: 'lab_service_prices' })
@Index('idx_lab_service_prices_lookup', [
  'labServiceId',
  'organizationId',
  'effectiveFrom',
])
@Check(
  'chk_lab_service_prices_amounts',
  `"unit_price_minor" >= 0 AND "rush_surcharge_minor" >= 0`,
)
@Check(
  'chk_lab_service_prices_dates',
  `"effective_to" IS NULL OR "effective_to" >= "effective_from"`,
)
@Exclusion(
  'excl_lab_service_prices_overlap',
  `USING gist ("lab_service_id" WITH =, COALESCE("organization_id", '00000000-0000-0000-0000-000000000000'::uuid) WITH =, daterange("effective_from", "effective_to", '[]') WITH &&) WHERE ("voided_at" IS NULL)`,
)
export class LabServicePrice {
  @UuidV7PrimaryColumn()
  id: string;

  @ManyToOne(() => LabService, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_service_id' })
  labService: LabService;

  @Column({ name: 'lab_service_id', type: 'uuid' })
  labServiceId: string;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  /** Null = the lab's list price for every clinic without a negotiated one. */
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @MinorColumn('unit_price_minor')
  unitPriceMinor: number;

  @MinorColumn('rush_surcharge_minor')
  rushSurchargeMinor: number;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'PKR' })
  currency: string;

  /** "YYYY-MM-DD". */
  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  /** Set only on prices that never took effect (entered by mistake). */
  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;
}
