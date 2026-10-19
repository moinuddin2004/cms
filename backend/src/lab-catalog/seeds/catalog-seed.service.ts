import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { Specialty } from 'src/engine/entities/specialty.entity';
import { ServiceCategoriesService } from '../categories/service-categories.service';
import { ServiceCategory } from '../entities/service-category.entity';

const SYSTEM: ActorRef = { userId: null, side: ActorSide.SYSTEM };

/** Default categories per specialty code. Data, not code branches. */
export const CATEGORY_SEEDS: {
  specialty: string;
  code: string;
  name: string;
}[] = [
  { specialty: 'DENTAL', code: 'CROWN', name: 'Crowns' },
  { specialty: 'DENTAL', code: 'BRIDGE', name: 'Bridges' },
  { specialty: 'DENTAL', code: 'IMPLANT', name: 'Implant restorations' },
  { specialty: 'DENTAL', code: 'DENTURE', name: 'Dentures' },
  { specialty: 'DENTAL', code: 'ORTHO', name: 'Orthodontic appliances' },
  { specialty: 'DENTAL', code: 'REPAIR', name: 'Repairs & relines' },
];

/**
 * Seeds the default service categories on boot — insert-if-missing, never
 * touching rows admins may have edited. The module imports EngineModule,
 * so the engine seed (which creates the specialties) has run first.
 */
@Injectable()
export class CatalogSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogSeedService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly categories: ServiceCategoriesService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const created = await this.seed();
    if (created)
      this.logger.log(`Catalog seed: ${created} category(ies) created`);
  }

  async seed(): Promise<number> {
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtext('catalog_seed'))`);
      let created = 0;
      for (const [i, c] of CATEGORY_SEEDS.entries()) {
        const specialty = await m
          .getRepository(Specialty)
          .findOneBy({ code: c.specialty });
        if (!specialty) continue;
        const exists = await m
          .getRepository(ServiceCategory)
          .existsBy({ specialtyId: specialty.id, code: c.code });
        if (exists) continue;
        await this.categories.createInTx(m, SYSTEM, {
          specialtyId: specialty.id,
          code: c.code,
          name: c.name,
          sortOrder: (i + 1) * 10,
        });
        created++;
      }
      return created;
    });
  }
}
