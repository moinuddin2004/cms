import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from 'src/user/entities/user.entity';
import { Organization } from './organization.entity';

@Entity({ name: 'organization_ownership' })
@Unique(['userId', 'organizationId'])
@Index(['userId', 'organizationId'])
export class OrganizationOwnership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'is_primary_owner', type: 'boolean', default: false })
  isPrimaryOwner: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
