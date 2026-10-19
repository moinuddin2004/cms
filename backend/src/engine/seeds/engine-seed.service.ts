import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { FormSchema } from '../entities/form-schema.entity';
import { Specialty } from '../entities/specialty.entity';
import { StageTemplate } from '../entities/stage-template.entity';
import { WorkflowEffect } from '../entities/workflow-effect.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';
import { FormSchemasService } from '../forms/form-schemas.service';
import { EffectRegistry } from '../runtime/effect-registry';
import { StageTemplatesService } from '../stages/stage-templates.service';
import { WorkflowTemplatesService } from '../workflows/workflow-templates.service';
import { FORM_SEEDS, SPECIALTY_SEEDS } from './dental-forms.seed';
import { STAGE_TEMPLATE_SEEDS, WORKFLOW_SEEDS } from './dental-workflows.seed';

const SYSTEM: ActorRef = { userId: null, side: ActorSide.SYSTEM };

/**
 * On boot: syncs `workflow_effects` with the handlers in code, then seeds
 * platform specialties, forms, workflows and stage templates —
 * insert-if-missing only. Existing rows are never touched: published
 * versions are immutable and admins may have changed things since. Runs on
 * application bootstrap so every effect handler has registered; one
 * advisory lock so an API and a worker booting together don't both insert.
 */
@Injectable()
export class EngineSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EngineSeedService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly registry: EffectRegistry,
    private readonly forms: FormSchemasService,
    private readonly workflows: WorkflowTemplatesService,
    private readonly stages: StageTemplatesService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const created = await this.seed();
    if (created) this.logger.log(`Engine seed: ${created} record(s) created`);
  }

  /** Returns how many specialties, forms, workflows and stage templates were created. */
  async seed(): Promise<number> {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtext('engine_seed'))`);
      await this.syncEffects(m);
      let created = 0;

      const specialtyIds = new Map<string, string>();
      for (const s of SPECIALTY_SEEDS) {
        const repo = m.getRepository(Specialty);
        let row = await repo.findOneBy({ code: s.code });
        if (!row) {
          row = await repo.save(
            repo.create({
              code: s.code,
              name: s.name,
              enabledByDefault: s.enabledByDefault,
            }),
          );
          created++;
        }
        specialtyIds.set(s.code, row.id);
      }
      const platform = (specialty: string, code: string) => ({
        specialtyId: specialtyIds.get(specialty)!,
        code,
        organizationId: IsNull(),
      });

      for (const f of FORM_SEEDS) {
        if (
          await m
            .getRepository(FormSchema)
            .existsBy(platform(f.specialty, f.code))
        )
          continue;
        await this.forms.createInTx(m, SYSTEM, {
          specialtyId: specialtyIds.get(f.specialty)!,
          organizationId: null,
          code: f.code,
          name: f.name,
          description: f.description,
          content: {
            schemaJson: { fields: f.fields },
            uiJson: f.ui ?? null,
            promotions: f.promotions ?? {},
          },
          publish: true,
        });
        created++;
      }

      for (const w of WORKFLOW_SEEDS) {
        if (
          await m
            .getRepository(WorkflowTemplate)
            .existsBy(platform(w.specialty, w.code))
        ) {
          continue;
        }
        await this.workflows.createInTx(m, SYSTEM, {
          specialtyId: specialtyIds.get(w.specialty)!,
          organizationId: null,
          entityType: w.entityType,
          code: w.code,
          name: w.name,
          description: null,
          definition: w.definition,
          publish: true,
        });
        created++;
      }

      for (const st of STAGE_TEMPLATE_SEEDS) {
        if (
          await m
            .getRepository(StageTemplate)
            .existsBy(platform(st.specialty, st.code))
        ) {
          continue;
        }
        await this.stages.createInTx(m, SYSTEM, {
          specialtyId: specialtyIds.get(st.specialty)!,
          organizationId: null,
          code: st.code,
          name: st.name,
          steps: st.steps,
        });
        created++;
      }
      return created;
    });
  }

  /** Rows for every handler in code; rows whose handler is gone are flagged. */
  private async syncEffects(m: EntityManager): Promise<void> {
    const handlers = this.registry.all();
    const repo = m.getRepository(WorkflowEffect);
    if (handlers.length) {
      await repo.upsert(
        handlers.map((h) => ({
          code: h.code,
          description: h.description,
          isFinancial: h.isFinancial,
          isAvailable: true,
        })),
        ['code'],
      );
    }
    await m.query(
      `UPDATE workflow_effects SET is_available = (code = ANY($1::text[]))`,
      [handlers.map((h) => h.code)],
    );
  }
}
