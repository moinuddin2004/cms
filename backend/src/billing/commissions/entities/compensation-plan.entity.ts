import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Exclusion,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { MinorColumn } from '../../common/minor-column';
import { CommissionBasis, CompensationPlanType } from '../commission.enums';
import { CommissionRule } from './commission-rule.entity';

/**
 * How one assignment (employee × location) is paid, valid for
 * [effectiveFrom, effectiveTo] (inclusive; null `effectiveTo` = current).
 * Versions never overlap (exclusion constraint, needs btree_gist); a change
 * closes the current version and adds a new one, so old charges keep the
 * rate they were snapshotted with.
 */
@Entity({ name: 'compensation_plans' })
@Index('idx_compensation_plans_assignment', ['assignmentId', 'effectiveFrom'])
@Check(
  'chk_compensation_plans_fields',
  `("type" = 'SALARY' AND "base_salary_minor" IS NOT NULL AND "default_rate_bps" IS NULL)
   OR ("type" = 'COMMISSION' AND "default_rate_bps" IS NOT NULL AND "base_salary_minor" IS NULL)
   OR ("type" = 'SALARY_PLUS_COMMISSION' AND "base_salary_minor" IS NOT NULL AND "default_rate_bps" IS NOT NULL)`,
)
@Check(
  'chk_compensation_plans_rate',
  `"default_rate_bps" IS NULL OR "default_rate_bps" BETWEEN 0 AND 10000`,
)
@Check(
  'chk_compensation_plans_salary',
  `"base_salary_minor" IS NULL OR "base_salary_minor" >= 0`,
)
@Check(
  'chk_compensation_plans_dates',
  `"effective_to" IS NULL OR "effective_to" >= "effective_from"`,
)
@Exclusion(
  'excl_compensation_plans_overlap',
  `USING gist ("assignment_id" WITH =, daterange("effective_from", "effective_to", '[]') WITH &&)`,
)
export class CompensationPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => EmployeeOrgLocationAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: EmployeeOrgLocationAssignment;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @Column({ name: 'type', type: 'enum', enum: CompensationPlanType })
  type: CompensationPlanType;

  @MinorColumn('base_salary_minor', { nullable: true })
  baseSalaryMinor: number | null;

  /** Basis points: 4000 = 40.00%. */
  @Column({ name: 'default_rate_bps', type: 'int', nullable: true })
  defaultRateBps: number | null;

  @Column({
    name: 'commission_basis',
    type: 'enum',
    enum: CommissionBasis,
    default: CommissionBasis.NET,
  })
  commissionBasis: CommissionBasis;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;

  @OneToMany(() => CommissionRule, (r) => r.plan)
  rules: CommissionRule[];

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
