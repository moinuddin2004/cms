import {
  DataSource,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import type { LabActorContext } from './lab-portal.constants';

/** Any lab-owned row: the portal filters every read on this column. */
export interface LabOwned extends ObjectLiteral {
  labId: string;
}

/**
 * Base for lab portal services (Sprint 6+ orders, production, billing):
 * every read starts from `scoped()` / `findScoped()`, which are already
 * filtered by the caller's lab, so a forgotten `WHERE lab_id` can't leak
 * another lab's rows. Ids of other labs' rows answer "not found". Writes
 * take `@RequestActor(ActorSide.LAB)` for audit, like every other module.
 *
 *   @Injectable()
 *   export class LabOrdersPortalService extends LabScopedService {
 *     list(actor: LabActorContext) {
 *       return this.scoped(LabOrder, 'o', actor).orderBy('o.created_at').getMany();
 *     }
 *   }
 */
export abstract class LabScopedService {
  protected constructor(protected readonly dataSource: DataSource) {}

  /**
   * `SELECT … FROM <entity> alias WHERE alias.lab_id = :labId`. Add filters
   * with `andWhere()` — `where()` would replace the lab filter.
   */
  protected scoped<T extends LabOwned>(
    entity: EntityTarget<T>,
    alias: string,
    actor: Pick<LabActorContext, 'labId'>,
    manager: EntityManager = this.dataSource.manager,
  ): SelectQueryBuilder<T> {
    return labScoped(manager, entity, alias, actor.labId);
  }

  /** One lab-owned row by id within the caller's lab, or null. */
  protected findScoped<T extends LabOwned & { id: string }>(
    entity: EntityTarget<T>,
    id: string,
    actor: Pick<LabActorContext, 'labId'>,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<T | null> {
    return manager
      .getRepository(entity)
      .findOneBy({ id, labId: actor.labId } as FindOptionsWhere<T>);
  }
}

/** A query builder pre-filtered to one lab. The alias's `lab_id` column. */
export function labScoped<T extends LabOwned>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  alias: string,
  labId: string,
): SelectQueryBuilder<T> {
  return manager
    .getRepository(entity)
    .createQueryBuilder(alias)
    .where(`${alias}.lab_id = :scopeLabId`, { scopeLabId: labId });
}
