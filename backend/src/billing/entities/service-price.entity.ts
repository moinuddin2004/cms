import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from 'src/employees/entities/employee.entity';
import { MoneyColumn } from '../common/money-column';
import { CatalogService } from './catalog-service.entity';

/**
 * Price override of a catalog service for a location, optionally for one
 * doctor (5.3). Doctors are employees, same as queue sessions (V4).
 */
@Entity({ name: 'service_prices' })
@Index('uq_service_prices_loc', ['serviceId', 'locationId'], {
  unique: true,
  where: 'doctor_id IS NULL',
})
@Index('uq_service_prices_loc_doc', ['serviceId', 'locationId', 'doctorId'], {
  unique: true,
  where: 'doctor_id IS NOT NULL',
})
export class ServicePrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'location_id', type: 'uuid' })
  locationId: string;

  @ManyToOne(() => CatalogService, (s) => s.prices, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'service_id' })
  service: CatalogService;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Employee | null;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  @MoneyColumn('price')
  price: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
