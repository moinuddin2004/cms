import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from 'src/organizations/entities/organization.entity';
import { Location } from 'src/locations/entities/location.entity';
import { PageSize, PageOrientation } from '../enums/page-size.enum';

/**
 * Visual + structural layout for the printed prescription PDF: page size,
 * margins, header/footer content, fonts, colors, toggles. A location can have
 * its own default template; otherwise the org-wide default (locationId=null)
 * applies. Multiple templates per location are allowed for special cases
 * (e.g. a duplicate copy with a watermark).
 *
 * The `header` / `footer` / `styling` columns are JSONB so we can extend the
 * shape without migrations — the contract is documented in the related DTOs.
 */
@Entity({ name: 'prescription_templates' })
@Index(['organizationId', 'isActive'])
@Index(['locationId', 'isDefault'])
export class PrescriptionTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'location_id' })
  location: Location | null;

  /** Null = org-wide template applicable to any location. */
  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId: string | null;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;

  @Column({
    name: 'page_size',
    type: 'enum',
    enum: PageSize,
    default: PageSize.A4,
  })
  pageSize: PageSize;

  @Column({
    name: 'orientation',
    type: 'enum',
    enum: PageOrientation,
    default: PageOrientation.PORTRAIT,
  })
  orientation: PageOrientation;

  /** Only used when pageSize === CUSTOM. */
  @Column({
    name: 'custom_width_mm',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  customWidthMm: number | null;

  @Column({
    name: 'custom_height_mm',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  customHeightMm: number | null;

  /**
   * Header content: logo, clinic + doctor names (English + Urdu),
   * qualifications, phones, registration number. See CreatePrescriptionTemplateDto.
   */
  @Column({ name: 'header', type: 'jsonb', default: () => `'{}'` })
  header: Record<string, any>;

  /** Footer content: address, timings, disclaimer (English + Urdu). */
  @Column({ name: 'footer', type: 'jsonb', default: () => `'{}'` })
  footer: Record<string, any>;

  /**
   * Styling: colors, fonts, sizes, toggles (showVitals, showMedicineUrdu,
   * signaturePosition, watermarkText, margins).
   */
  @Column({ name: 'styling', type: 'jsonb', default: () => `'{}'` })
  styling: Record<string, any>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
