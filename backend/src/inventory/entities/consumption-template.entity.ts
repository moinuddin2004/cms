import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { ConsumptionTemplateItem } from './consumption-template-item.entity';

@Entity({ name: 'consumption_templates' })
@Index(['organizationId', 'isActive'])
@Index(['organizationId', 'appointmentType'])
export class ConsumptionTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  name: string;
  // Example: "Root Canal Kit", "Teeth Cleaning Kit", "Extraction Kit", "Facial Treatment Kit"

  @Column()
  procedureName: string;
  // Example: "Root Canal", "Teeth Cleaning", "Extraction", "Chemical Peel"

  @Column({ type: 'varchar', nullable: true })
  appointmentType: string | null;
  // Maps to your existing appointment type enum (CONSULTATION, ROOT_CANAL, EXTRACTION etc.)
  // Used for AUTO-MATCHING: when doctor starts this type of appointment, this template auto-suggests

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ConsumptionTemplateItem, (item) => item.template, {
    cascade: true,
    eager: true,
  })
  items: ConsumptionTemplateItem[];
}
