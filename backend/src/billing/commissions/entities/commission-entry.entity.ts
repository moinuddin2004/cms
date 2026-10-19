import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { Charge } from '../../entities/charge.entity';
import { PaisaColumn } from '../../common/paisa-column';
import { CommissionSourceType } from '../commission.enums';
import { CommissionSettlement } from './commission-settlement.entity';

/**
 * Append-only commission ledger (signed paisa). For each charge,
 * SUM(amount_paisa) always equals the commission target for what has been
 * collected on it; every change inserts only the difference. Amounts are
 * never updated and rows are never deleted (a trigger enforces it); only
 * `settlement_id` is set once, by settlement.
 */
@Entity({ name: 'commission_entries' })
@Index('uq_commission_entries_source', ['sourceType', 'sourceId', 'chargeId'], {
  unique: true,
})
@Index('idx_commission_entries_assignment', ['assignmentId', 'createdAt'])
@Index('idx_commission_entries_unsettled', ['assignmentId'], {
  where: `"settlement_id" IS NULL`,
})
@Index('idx_commission_entries_charge', ['chargeId'])
export class CommissionEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => EmployeeOrgLocationAssignment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: EmployeeOrgLocationAssignment;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @ManyToOne(() => Charge, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'charge_id' })
  charge: Charge;

  @Column({ name: 'charge_id', type: 'uuid' })
  chargeId: string;

  @Column({ name: 'source_type', type: 'enum', enum: CommissionSourceType })
  sourceType: CommissionSourceType;

  /** The payment (new money) or the operation id that caused the entry. */
  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  /** Collected on the charge (capped at net) when the entry was written. */
  @PaisaColumn('base_paisa')
  basePaisa: number;

  @Column({ name: 'rate_bps', type: 'int', nullable: true })
  rateBps: number | null;

  /** Signed: negative reverses earlier commission. */
  @PaisaColumn('amount_paisa')
  amountPaisa: number;

  @ManyToOne(() => CommissionSettlement, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'settlement_id' })
  settlement: CommissionSettlement | null;

  @Column({ name: 'settlement_id', type: 'uuid', nullable: true })
  settlementId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
