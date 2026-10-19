import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import { engineError } from '../common/engine-errors';
import { FormSchemaVersion } from '../entities/form-schema-version.entity';
import { DefinitionStatus } from '../enums/engine.enums';
import { SpecialtiesService } from '../specialties/specialties.service';
import { FormDataResult, validateFormData } from './form-data.validator';
import {
  CurrentForm,
  FormVersionResponse,
  toVersionResponse,
} from './form-responses';

/**
 * The clinic side of forms: which version an organization fills in today,
 * and validation of answers against a pinned version. Organizations see
 * platform defaults and their own forms — never drafts, never another
 * organization's forms (those answer 404).
 */
@Injectable()
export class FormResolverService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly specialties: SpecialtiesService,
  ) {}

  /**
   * The published form per code for the organization's specialties. The
   * organization's own form with a code overrides the platform default.
   */
  async current(
    organizationId: string,
    specialtyCode?: string,
    m: EntityManager = this.dataSource.manager,
  ): Promise<CurrentForm[]> {
    const enabled = specialtyCode
      ? [await this.specialties.assertEnabled(organizationId, specialtyCode, m)]
      : await this.specialties.enabledFor(organizationId, m);
    if (!enabled.length) return [];

    const versions = await m
      .getRepository(FormSchemaVersion)
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.formSchema', 's')
      .innerJoinAndSelect('s.specialty', 'sp')
      .where('v.status = :published', { published: DefinitionStatus.PUBLISHED })
      .andWhere('s.is_active')
      .andWhere('s.specialty_id IN (:...ids)', {
        ids: enabled.map((e) => e.id),
      })
      .andWhere(
        new Brackets((w) =>
          w
            .where('s.organization_id IS NULL')
            .orWhere('s.organization_id = :organizationId', { organizationId }),
        ),
      )
      .getMany();

    const byCode = new Map<string, FormSchemaVersion>();
    for (const v of versions) {
      const key = `${v.formSchema.specialty.code}:${v.formSchema.code}`;
      const existing = byCode.get(key);
      if (
        !existing ||
        (v.formSchema.organizationId && !existing.formSchema.organizationId)
      ) {
        byCode.set(key, v);
      }
    }
    return [...byCode.values()]
      .sort((a, b) => a.formSchema.name.localeCompare(b.formSchema.name))
      .map((v) => ({
        formSchemaId: v.formSchemaId,
        code: v.formSchema.code,
        name: v.formSchema.name,
        description: v.formSchema.description,
        specialtyCode: v.formSchema.specialty.code,
        isOrganizationForm: v.formSchema.organizationId !== null,
        versionId: v.id,
        versionNo: v.versionNo,
        schemaJson: v.schemaJson,
        uiJson: v.uiJson,
      }));
  }

  /** A published or retired version the organization may see (pinned orders). */
  async version(
    organizationId: string,
    versionId: string,
    m: EntityManager = this.dataSource.manager,
  ): Promise<FormVersionResponse> {
    return toVersionResponse(await this.load(m, organizationId, versionId), []);
  }

  /**
   * Validates answers against the given version. Retired versions still
   * validate — orders pinned to them must keep working (lab ERD §17).
   */
  async validate(
    organizationId: string,
    versionId: string,
    data: unknown,
    m: EntityManager = this.dataSource.manager,
  ): Promise<FormDataResult> {
    const v = await this.load(m, organizationId, versionId);
    return validateFormData(v.schemaJson, data);
  }

  private async load(
    m: EntityManager,
    organizationId: string,
    versionId: string,
  ): Promise<FormSchemaVersion> {
    const v = await m.getRepository(FormSchemaVersion).findOne({
      where: { id: versionId },
      relations: { formSchema: true },
    });
    const visible =
      v &&
      v.status !== DefinitionStatus.DRAFT &&
      (v.formSchema.organizationId === null ||
        v.formSchema.organizationId === organizationId);
    if (!visible) throw engineError('FORM_VERSION_NOT_FOUND', 'Form not found');
    return v;
  }
}
