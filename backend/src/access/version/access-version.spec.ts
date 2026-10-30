import { AccessChange, AccessChangeBus } from './access-change-bus';
import { AccessVersionService } from './access-version.service';
import { AccessVersionSubscriber } from './access-version.subscriber';
import { EmploymentRole } from 'src/employees/entities/employment-role.entity';
import { EmployeeOrgLocationAssignment } from 'src/employees/entities/employee-org-location-assignment.entity';
import { Patient } from 'src/patients/entities/patient.entity';

describe('AccessChangeBus', () => {
  const bus = () => new AccessChangeBus({ get: () => undefined } as never);

  it('delivers locally on publish (no Redis needed)', async () => {
    const b = bus();
    const seen: AccessChange[] = [];
    b.onChange((c) => seen.push(c));
    await b.publish({ organizationId: 'o', version: 3 });
    expect(seen).toEqual([{ organizationId: 'o', version: 3 }]);
  });

  it('opens no Redis connection without REDIS_URL', async () => {
    const b = bus();
    b.onModuleInit();
    expect((b as unknown as { pub: unknown; sub: unknown }).pub).toBeNull();
    expect((b as unknown as { pub: unknown; sub: unknown }).sub).toBeNull();
    await b.onApplicationShutdown();
  });

  it("delivers other instances' messages, ignores its own and junk", () => {
    const b = bus();
    const seen: AccessChange[] = [];
    const stop = b.onChange((c) => seen.push(c));
    b.onMessage(
      JSON.stringify({ origin: 'other', organizationId: 'o', version: 4 }),
    );
    b.onMessage(
      JSON.stringify({
        origin: (b as unknown as { instanceId: string }).instanceId,
        organizationId: 'o',
        version: 5,
      }),
    );
    b.onMessage('not json');
    b.onMessage(JSON.stringify({ origin: 'other', organizationId: 'o' }));
    expect(seen).toEqual([{ organizationId: 'o', version: 4 }]);
    stop();
    b.onMessage(
      JSON.stringify({ origin: 'other', organizationId: 'o', version: 6 }),
    );
    expect(seen).toHaveLength(1);
  });
});

describe('AccessVersionService', () => {
  function make(rows: { access_version: number }[] = [{ access_version: 7 }]) {
    const ds = { query: jest.fn() };
    const published: AccessChange[] = [];
    let listener: (c: AccessChange) => void = () => undefined;
    const bus = {
      onChange: (l: (c: AccessChange) => void) => (listener = l),
      publish: jest.fn((c: AccessChange) => {
        published.push(c);
        listener(c);
        return Promise.resolve();
      }),
    };
    ds.query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.startsWith('UPDATE') ? [[{ access_version: 8 }], 1] : rows,
      ),
    );
    return {
      svc: new AccessVersionService(ds as never, bus as never),
      ds,
      published,
      hear: (c: AccessChange) => listener(c),
    };
  }

  it('reads and caches the version', async () => {
    const { svc, ds } = make();
    expect(await svc.current('o')).toBe(7);
    expect(await svc.current('o')).toBe(7);
    expect(ds.query).toHaveBeenCalledTimes(1);
  });

  it('does not cache unknown orgs', async () => {
    const { svc, ds } = make([]);
    expect(await svc.current('nope')).toBe(0);
    await svc.current('nope');
    expect(ds.query).toHaveBeenCalledTimes(2);
  });

  it('bump increments, publishes and updates its own cache', async () => {
    const { svc, ds, published } = make();
    await svc.current('o');
    expect(await svc.bump('o')).toBe(8);
    expect(published).toEqual([{ organizationId: 'o', version: 8 }]);
    expect(await svc.current('o')).toBe(8);
    expect(ds.query).toHaveBeenCalledTimes(2);
  });

  it('takes newer versions from the bus, never older ones', async () => {
    const { svc, hear } = make();
    await svc.current('o');
    hear({ organizationId: 'o', version: 9 });
    expect(await svc.current('o')).toBe(9);
    hear({ organizationId: 'o', version: 3 });
    expect(await svc.current('o')).toBe(9);
  });
});

describe('AccessVersionSubscriber', () => {
  function make() {
    const ds = { subscribers: [] as unknown[] };
    const versions = { bumpQuietly: jest.fn(() => Promise.resolve(undefined)) };
    const sub = new AccessVersionSubscriber(ds as never, versions as never);
    return { sub, ds, versions };
  }
  const runner = (inTx: boolean) => ({ isTransactionActive: inTx, data: {} });
  const meta = (target: object) => ({ target }) as never;

  it('registers itself with the data source', () => {
    const { sub, ds } = make();
    expect(ds.subscribers).toContain(sub);
  });

  it('bumps once per org after the outermost commit', async () => {
    const { sub, versions } = make();
    const qr = runner(true);
    await sub.afterInsert({
      metadata: meta(EmploymentRole),
      entity: { organizationId: 'o1' },
      queryRunner: qr,
    } as never);
    await sub.afterInsert({
      metadata: meta(EmploymentRole),
      entity: { organizationId: 'o1' },
      queryRunner: qr,
    } as never);
    await sub.afterRemove({
      metadata: meta(EmploymentRole),
      entity: undefined,
      databaseEntity: { organizationId: 'o2' },
      queryRunner: qr,
    } as never);
    expect(versions.bumpQuietly).not.toHaveBeenCalled();

    await sub.afterTransactionCommit({ queryRunner: qr } as never); // savepoint release
    expect(versions.bumpQuietly).not.toHaveBeenCalled();
    qr.isTransactionActive = false;
    await sub.afterTransactionCommit({ queryRunner: qr } as never);
    expect(versions.bumpQuietly.mock.calls).toEqual([['o1'], ['o2']]);
  });

  it('drops pending bumps on rollback', async () => {
    const { sub, versions } = make();
    const qr = runner(true);
    await sub.afterInsert({
      metadata: meta(EmploymentRole),
      entity: { organizationId: 'o1' },
      queryRunner: qr,
    } as never);
    qr.isTransactionActive = false;
    sub.afterTransactionRollback({ queryRunner: qr } as never);
    await sub.afterTransactionCommit({ queryRunner: qr } as never);
    expect(versions.bumpQuietly).not.toHaveBeenCalled();
  });

  it('bumps immediately outside a transaction', async () => {
    const { sub, versions } = make();
    await sub.afterInsert({
      metadata: meta(EmploymentRole),
      entity: { organizationId: 'o1' },
      queryRunner: runner(false),
    } as never);
    expect(versions.bumpQuietly).toHaveBeenCalledWith('o1');
  });

  it('ignores unwatched entities and irrelevant assignment columns', async () => {
    const { sub, versions } = make();
    await sub.afterInsert({
      metadata: meta(Patient),
      entity: { organizationId: 'o1' },
      queryRunner: runner(false),
    } as never);
    const update = (prop: string) =>
      sub.afterUpdate({
        metadata: meta(EmployeeOrgLocationAssignment),
        entity: { organizationId: 'o1' },
        databaseEntity: { organizationId: 'o1' },
        updatedColumns: [{ propertyName: prop }],
        updatedRelations: [],
        queryRunner: runner(false),
      } as never);
    await update('designation');
    expect(versions.bumpQuietly).not.toHaveBeenCalled();
    await update('hasPortalAccess');
    expect(versions.bumpQuietly).toHaveBeenCalledWith('o1');
  });
});
