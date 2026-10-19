import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CatalogService } from '../../entities/catalog-service.entity';
import { ServiceKind } from '../../enums/billing.enums';
import { PaisaColumn } from '../../common/paisa-column';
import { CompensationPlan } from './compensation-plan.entity';

/**
 * A plan override for one catalog service or one service category
 * (`ServiceKind`): either a rate in basis points or a fixed amount per fully
 * paid charge. Resolution: service rule → category rule → plan default.
 */
@Entity({ name: 'commission_rules' })
@Index('uq_commission_rules_service', ['planId', 'serviceId'], {
  unique: true,
  where: `"service_id" IS NOT NULL`,
})
@Index('uq_commission_rules_category', ['planId', 'serviceCategory'], {
  unique: true,
  where: `"service_category" IS NOT NULL`,
})
@Check(
  'chk_commission_rules_amount',
  `("rate_bps" IS NULL) <> ("fixed_amount_paisa" IS NULL)`,
)
@Check(
  'chk_commission_rules_rate',
  `"rate_bps" IS NULL OR "rate_bps" BETWEEN 0 AND 10000`,
)
@Check(
  'chk_commission_rules_fixed',
  `"fixed_amount_paisa" IS NULL OR "fixed_amount_paisa" >= 0`,
)
@Check(
  'chk_commission_rules_target',
  `("service_id" IS NULL) <> ("service_category" IS NULL)`,
)
export class CommissionRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CompensationPlan, (p) => p.rules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: CompensationPlan;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId: string;

  @ManyToOne(() => CatalogService, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'service_id' })
  service: CatalogService | null;

  @Column({ name: 'service_id', type: 'uuid', nullable: true })
  serviceId: string | null;

  @Column({
    name: 'service_category',
    type: 'enum',
    enum: ServiceKind,
    nullable: true,
  })
  serviceCategory: ServiceKind | null;

  @Column({ name: 'rate_bps', type: 'int', nullable: true })
  rateBps: number | null;

  @PaisaColumn('fixed_amount_paisa', { nullable: true })
  fixedAmountPaisa: number | null;
}
