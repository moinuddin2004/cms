import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PrescriptionTemplate } from '../entities/prescription-template.entity';
import {
  CreatePrescriptionTemplateDto,
  UpdatePrescriptionTemplateDto,
} from '../dto/prescription-template.dto';

const DEFAULT_HEADER = {
  showLogo: true,
  headerHeightMm: 30,
};

const DEFAULT_FOOTER = {
  footerHeightMm: 18,
};

const DEFAULT_STYLING = {
  primaryColor: '#0d9488',
  fontFamily: 'Helvetica',
  urduFontFamily: 'Noto Nastaliq Urdu',
  headerFontSize: 14,
  bodyFontSize: 11,
  urduFontSize: 13,
  showVitals: true,
  showPatientAge: true,
  showPatientGender: true,
  showDate: true,
  showRegistrationNumber: true,
  medicineTableStyle: 'numbered',
  showMedicineUrdu: true,
  instructionPosition: 'bottom',
  showDoctorSignature: true,
  signaturePosition: 'bottom_right',
  watermarkText: null,
  borderStyle: 'simple',
  marginTopMm: 15,
  marginBottomMm: 15,
  marginLeftMm: 12,
  marginRightMm: 12,
};

@Injectable()
export class PrescriptionTemplateService {
  constructor(
    @InjectRepository(PrescriptionTemplate)
    private readonly repo: Repository<PrescriptionTemplate>,
  ) {}

  async create(
    organizationId: string,
    dto: CreatePrescriptionTemplateDto,
    createdBy: string | null,
  ): Promise<PrescriptionTemplate> {
    if (dto.isDefault) {
      await this.unsetDefault(organizationId, dto.locationId ?? null);
    }

    const row = this.repo.create({
      ...dto,
      organizationId,
      locationId: dto.locationId ?? null,
      header: { ...DEFAULT_HEADER, ...(dto.header || {}) },
      footer: { ...DEFAULT_FOOTER, ...(dto.footer || {}) },
      styling: { ...DEFAULT_STYLING, ...(dto.styling || {}) },
      createdBy,
    });
    return this.repo.save(row);
  }

  async findAll(
    organizationId: string,
    locationId?: string,
  ): Promise<PrescriptionTemplate[]> {
    const where: any = { organizationId, isActive: true };
    if (locationId) {
      // Either tied to this location, or an org-wide template (locationId null).
      const qb = this.repo
        .createQueryBuilder('t')
        .where('t.organization_id = :organizationId', { organizationId })
        .andWhere('t.is_active = :active', { active: true })
        .andWhere('(t.location_id = :locationId OR t.location_id IS NULL)', {
          locationId,
        })
        .orderBy('t.is_default', 'DESC')
        .addOrderBy('t.name', 'ASC');
      return qb.getMany();
    }
    return this.repo.find({
      where,
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  async findOne(
    id: string,
    organizationId: string,
  ): Promise<PrescriptionTemplate> {
    const row = await this.repo.findOne({ where: { id, organizationId } });
    if (!row) throw new NotFoundException('Prescription template not found');
    return row;
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdatePrescriptionTemplateDto,
  ): Promise<PrescriptionTemplate> {
    const row = await this.findOne(id, organizationId);

    if (dto.isDefault && !row.isDefault) {
      await this.unsetDefault(organizationId, row.locationId);
    }

    Object.assign(row, {
      ...dto,
      header: dto.header ? { ...row.header, ...dto.header } : row.header,
      footer: dto.footer ? { ...row.footer, ...dto.footer } : row.footer,
      styling: dto.styling ? { ...row.styling, ...dto.styling } : row.styling,
    });
    return this.repo.save(row);
  }

  /**
   * Lookup chain: location-default → org-wide default → null. Caller falls
   * back to a built-in default when null.
   */
  async getDefaultForLocation(
    organizationId: string,
    locationId: string,
  ): Promise<PrescriptionTemplate | null> {
    const locDefault = await this.repo.findOne({
      where: {
        organizationId,
        locationId,
        isDefault: true,
        isActive: true,
      },
    });
    if (locDefault) return locDefault;

    const orgDefault = await this.repo.findOne({
      where: {
        organizationId,
        locationId: IsNull(),
        isDefault: true,
        isActive: true,
      },
    });
    return orgDefault;
  }

  async deactivate(
    id: string,
    organizationId: string,
  ): Promise<{ id: string }> {
    const row = await this.findOne(id, organizationId);
    row.isActive = false;
    row.isDefault = false;
    await this.repo.save(row);
    return { id };
  }

  private async unsetDefault(
    organizationId: string,
    locationId: string | null,
  ): Promise<void> {
    await this.repo.update(
      {
        organizationId,
        locationId: locationId === null ? IsNull() : locationId,
        isDefault: true,
      },
      { isDefault: false },
    );
  }
}
