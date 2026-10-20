import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { PaisaColumn } from 'src/billing/common/paisa-column';
import { UuidV7PrimaryColumn } from 'src/common/database/uuid-v7';
import { Lab } from 'src/labs/entities/lab.entity';
import { StatementMatch, StatementStatus } from '../enums/payables.enums';

/**
 * A lab's monthly statement (lab ERD §6b), entered by the clinic and
 * reconciled against the bills of the period.
 */
@Entity({ name: 'lab_statements' })
@Index('idx_lab_statements_lab', ['organizationId', 'labId', 'periodStart'])
export class LabStatement {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Lab, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_id' })
  lab: Lab;

  @Column({ name: 'lab_id', type: 'uuid' })
  labId: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({
    name: 'statement_ref',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  statementRef: string | null;

  /** What the lab says is owed for the period. */
  @PaisaColumn('total_paisa')
  totalPaisa: number;

  /** No storage for statement files yet (attachments are order-scoped). */
  @Column({ name: 'attachment_id', type: 'uuid', nullable: true })
  attachmentId: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: StatementStatus,
    default: StatementStatus.UPLOADED,
  })
  status: StatementStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @VersionColumn({ name: 'version', default: 1 })
  version: number;

  @OneToMany(() => LabStatementLine, (l) => l.statement)
  lines: LabStatementLine[];
}

/**
 * One line of the statement, or a `missing_in_statement` row the
 * reconciliation added for a bill the lab left out.
 */
@Entity({ name: 'lab_statement_lines' })
@Index('idx_lab_statement_lines_statement', ['statementId'])
export class LabStatementLine {
  @UuidV7PrimaryColumn()
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => LabStatement, (s) => s.lines, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'statement_id' })
  statement: LabStatement;

  @Column({ name: 'statement_id', type: 'uuid' })
  statementId: string;

  /** Order no, bill no or the lab's invoice no; null on system rows. */
  @Column({
    name: 'lab_reference',
    type: 'varchar',
    length: 60,
    nullable: true,
  })
  labReference: string | null;

  @Column({ name: 'line_date', type: 'date', nullable: true })
  lineDate: string | null;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  description: string | null;

  /** The lab's amount; 0 on `missing_in_statement` rows. */
  @PaisaColumn('amount_paisa')
  amountPaisa: number;

  /** What the clinic's bills say for the same reference. */
  @PaisaColumn('system_amount_paisa', { nullable: true })
  systemAmountPaisa: number | null;

  @Column({ name: 'matched_bill_line_id', type: 'uuid', nullable: true })
  matchedBillLineId: string | null;

  @Column({ name: 'matched_bill_id', type: 'uuid', nullable: true })
  matchedBillId: string | null;

  @Column({ name: 'match_status', type: 'enum', enum: StatementMatch })
  matchStatus: StatementMatch;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
