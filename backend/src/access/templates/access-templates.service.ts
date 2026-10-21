import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { Organization } from 'src/organizations/entities/organization.entity';
import { ROLE_TEMPLATES, templateSlug } from '../catalog/templates';

/**
 * Seeds the system role templates (Admin, Doctor, Receptionist, Assistant,
 * Accountant) into orgs: on boot for every org, and when an org is created.
 * Insert-missing only, keyed by `template_key`: an existing template role is
 * never changed (clinic edits stick); one the clinic deleted is recreated on
 * the next boot. Concurrent processes are safe: conflicts on (org, slug) are
 * ignored.
 */
@Injectable()
export class AccessTemplatesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AccessTemplatesService.name);

  constructor(
    @InjectRepository(EmploymentRole)
    private readonly roleRepo: Repository<EmploymentRole>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  async onApplicationBootstrap() {
    try {
      const created = await this.seedAll();
      this.logger.log(`Role templates checked (${created} created)`);
    } catch (err) {
      // Never block boot (e.g. a worker starting before schema sync).
      this.logger.error(
        `Role template seeding failed: ${(err as Error).message}`,
      );
    }
  }

  /** Seed every org. Returns how many roles were inserted. */
  async seedAll(): Promise<number> {
    const orgs = await this.orgRepo.find({ select: { id: true } });
    return this.seed(orgs.map((o) => o.id));
  }

  /** Seed one org (call right after creating it). */
  async seedForOrg(organizationId: string): Promise<number> {
    return this.seed([organizationId]);
  }

  private async seed(organizationIds: string[]): Promise<number> {
    if (!organizationIds.length) return 0;
    const existing = await this.roleRepo.find({
      where: {
        organizationId: In(organizationIds),
        templateKey: In(ROLE_TEMPLATES.map((t) => t.key)),
      },
      select: { organizationId: true, templateKey: true },
    });
    const have = new Set(
      existing.map((r) => `${r.organizationId}|${r.templateKey}`),
    );

    const rows: Partial<EmploymentRole>[] = [];
    for (const organizationId of organizationIds) {
      for (const t of ROLE_TEMPLATES) {
        if (have.has(`${organizationId}|${t.key}`)) continue;
        rows.push({
          organizationId,
          name: t.name,
          slug: templateSlug(t.key),
          description: t.description,
          templateKey: t.key,
          homeRoute: t.homeRoute,
          permissions: { ...t.permissions },
          isSystemRole: true,
          isActive: true,
        });
      }
    }
    if (!rows.length) return 0;

    const result = await this.roleRepo
      .createQueryBuilder()
      .insert()
      .into(EmploymentRole)
      .values(rows)
      .orIgnore()
      .execute();
    return result.identifiers.filter(Boolean).length;
  }
}
