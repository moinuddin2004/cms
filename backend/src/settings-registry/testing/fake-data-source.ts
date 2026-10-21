import { FindOperator } from 'typeorm';
import { ConfigValue } from '../entities/config-value.entity';
import { Location } from 'src/locations/entities/location.entity';
import { Organization } from 'src/organizations/entities/organization.entity';

type Row = Record<string, unknown>;
type Where = Row | Row[];

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v instanceof FindOperator) {
      if (v.type === 'isNull') return row[k] === null || row[k] === undefined;
      if (v.type === 'in') return (v.value as unknown[]).includes(row[k]);
      throw new Error(`Unsupported operator ${v.type}`);
    }
    return row[k] === v;
  });
}

const filter = (rows: Row[], where?: Where) =>
  !where
    ? rows
    : rows.filter((r) =>
        (Array.isArray(where) ? where : [where]).some((w) => matches(r, w)),
      );

class FakeRepo {
  findCalls = 0;

  constructor(public rows: Row[]) {}

  find(opts: { where?: Where } = {}) {
    this.findCalls += 1;
    return Promise.resolve(
      filter(this.rows, opts.where).map((r) => ({ ...r })),
    );
  }

  findOne(opts: { where?: Where }) {
    const hit = filter(this.rows, opts.where)[0];
    return Promise.resolve(hit ? { ...hit } : null);
  }

  exists(opts: { where?: Where }) {
    return Promise.resolve(filter(this.rows, opts.where).length > 0);
  }

  create(data: Row) {
    return { ...data };
  }

  save(entity: Row) {
    if (!entity.id) entity.id = `id-${this.rows.length + 1}`;
    const i = this.rows.findIndex((r) => r.id === entity.id);
    if (i >= 0) this.rows[i] = { ...entity };
    else this.rows.push({ ...entity });
    return Promise.resolve(entity);
  }
}

/** In-memory stand-in for the bits of DataSource/EntityManager the registry uses. */
export class FakeDataSource {
  readonly configValues = new FakeRepo([]);
  readonly locations = new FakeRepo([]);
  readonly organizations = new FakeRepo([]);
  readonly manager = { getRepository: (e: unknown) => this.getRepository(e) };

  getRepository(entity: unknown) {
    if (entity === ConfigValue) return this.configValues;
    if (entity === Location) return this.locations;
    if (entity === Organization) return this.organizations;
    throw new Error('Unexpected repository');
  }

  async transaction<T>(cb: (manager: unknown) => Promise<T>): Promise<T> {
    return cb(this.manager);
  }
}
