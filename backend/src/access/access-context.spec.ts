import { AccessContext, AccessContextInit } from './access-context';

function ctx(over: Partial<AccessContextInit> = {}) {
  return new AccessContext({
    userId: 'u1',
    organizationId: 'org1',
    locationId: 'loc1',
    version: 1,
    isSuperAdmin: false,
    isOwner: false,
    isMember: true,
    employeeId: 'emp1',
    features: [],
    permissions: {},
    roles: [],
    homeRoute: null,
    ...over,
  });
}

interface FakeQb {
  wheres: { sql: string; params?: Record<string, unknown> }[];
  andWhere(sql: string, params?: Record<string, unknown>): FakeQb;
}

function fakeQb(): FakeQb {
  const qb: FakeQb = {
    wheres: [],
    andWhere: (sql, params) => {
      qb.wheres.push({ sql, params });
      return qb;
    },
  };
  return qb;
}

const cols = { own: 'p.primary_doctor_id', location: 'p.location_id' };

describe('AccessContext', () => {
  it('can / canAll / scope', () => {
    const c = ctx({
      permissions: { 'patients.view': 'own', 'billing.desk.use': true },
    });
    expect(c.can('patients.view')).toBe(true);
    expect(c.can('patients.edit')).toBe(false);
    expect(c.canAll(['patients.view', 'billing.desk.use'])).toBe(true);
    expect(c.canAll(['patients.view', 'patients.edit'])).toBe(false);
    expect(c.scope('patients.view')).toBe('own');
    expect(c.scope('billing.desk.use')).toBe('org');
    expect(c.scope('patients.edit')).toBeNull();
    expect(c.can('canManageSettings' as never)).toBe(false);
  });

  describe('applyScope', () => {
    it('own → owning employee column', () => {
      const qb = fakeQb();
      ctx({ permissions: { 'patients.view': 'own' } }).applyScope(
        qb,
        'patients.view',
        cols,
      );
      expect(qb.wheres).toHaveLength(1);
      const [w] = qb.wheres;
      expect(w.sql).toMatch(/^p\.primary_doctor_id = :access_scope_\d+$/);
      expect(Object.values(w.params!)).toEqual(['emp1']);
    });

    it('location → location column', () => {
      const qb = fakeQb();
      ctx({ permissions: { 'patients.view': 'location' } }).applyScope(
        qb,
        'patients.view',
        cols,
      );
      expect(qb.wheres[0].sql).toMatch(/^p\.location_id = :access_scope_\d+$/);
      expect(Object.values(qb.wheres[0].params!)).toEqual(['loc1']);
    });

    it('org → no filter', () => {
      const qb = fakeQb();
      ctx({ permissions: { 'patients.view': 'org' } }).applyScope(
        qb,
        'patients.view',
        cols,
      );
      expect(qb.wheres).toEqual([]);
    });

    it('no grant, no employee or no location → no rows', () => {
      for (const c of [
        ctx(),
        ctx({ permissions: { 'patients.view': 'own' }, employeeId: null }),
        ctx({ permissions: { 'patients.view': 'location' }, locationId: null }),
      ]) {
        const qb = fakeQb();
        c.applyScope(qb, 'patients.view', cols);
        expect(qb.wheres).toEqual([{ sql: '1 = 0', params: undefined }]);
      }
    });

    it('uses a fresh parameter name per call', () => {
      const qb = fakeQb();
      const c = ctx({
        permissions: { 'patients.view': 'own', 'appointments.view': 'own' },
      });
      c.applyScope(qb, 'patients.view', cols);
      c.applyScope(qb, 'appointments.view', { own: 'a.doctor_id' });
      const names = qb.wheres.map((w) => Object.keys(w.params!)[0]);
      expect(new Set(names).size).toBe(2);
    });

    it('throws when the needed column is missing', () => {
      const c = ctx({ permissions: { 'patients.view': 'own' } });
      expect(() =>
        c.applyScope(fakeQb(), 'patients.view', { location: 'x' }),
      ).toThrow(/no column given for scope "own"/);
    });

    describe('ownWhere / locationWhere', () => {
      const pred = {
        own: 'p.primary_doctor_id',
        ownWhere:
          'EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.doctor_id = :employeeId) OR p.x = :employeeId',
        locationWhere: 'p.primary_location_id = :locationId',
      };

      it('own → the predicate, every :employeeId bound to one fresh name', () => {
        const qb = fakeQb();
        ctx({ permissions: { 'patients.view': 'own' } }).applyScope(
          qb,
          'patients.view',
          pred,
        );
        const [w] = qb.wheres;
        const [name] = Object.keys(w.params!);
        expect(name).toMatch(/^access_scope_\d+$/);
        expect(w.params).toEqual({ [name]: 'emp1' });
        expect(w.sql).not.toContain(':employeeId');
        expect(w.sql.split(`:${name}`)).toHaveLength(3);
        // wrapped so a top-level OR cannot escape the caller's other filters
        expect(w.sql.startsWith('(EXISTS')).toBe(true);
        expect(w.sql.endsWith(')')).toBe(true);
      });

      it('location → locationWhere bound to the active location', () => {
        const qb = fakeQb();
        ctx({ permissions: { 'patients.view': 'location' } }).applyScope(
          qb,
          'patients.view',
          pred,
        );
        expect(qb.wheres[0].sql).toMatch(
          /^\(p\.primary_location_id = :access_scope_\d+\)$/,
        );
        expect(Object.values(qb.wheres[0].params!)).toEqual(['loc1']);
      });

      it('never interpolates the value into the SQL', () => {
        const qb = fakeQb();
        const evil = "x' OR '1'='1";
        ctx({
          permissions: { 'patients.view': 'own' },
          employeeId: evil,
        }).applyScope(qb, 'patients.view', pred);
        expect(qb.wheres[0].sql).not.toContain(evil);
        expect(Object.values(qb.wheres[0].params!)).toEqual([evil]);
      });

      it('does not touch longer names that start with the token', () => {
        const qb = fakeQb();
        ctx({ permissions: { 'patients.view': 'own' } }).applyScope(
          qb,
          'patients.view',
          { ownWhere: 'a.doctor_id = :employeeId AND b.y = :employeeIds' },
        );
        expect(qb.wheres[0].sql).toContain(':employeeIds');
      });

      it('no grant or no employee → no rows', () => {
        for (const c of [
          ctx(),
          ctx({ permissions: { 'patients.view': 'own' }, employeeId: null }),
          ctx({
            permissions: { 'patients.view': 'location' },
            locationId: null,
          }),
        ]) {
          const qb = fakeQb();
          c.applyScope(qb, 'patients.view', pred);
          expect(qb.wheres).toEqual([{ sql: '1 = 0', params: undefined }]);
        }
      });

      it('org → no filter', () => {
        const qb = fakeQb();
        ctx({ permissions: { 'patients.view': 'org' } }).applyScope(
          qb,
          'patients.view',
          pred,
        );
        expect(qb.wheres).toEqual([]);
      });

      it('throws when the predicate does not use its token', () => {
        const c = ctx({ permissions: { 'patients.view': 'own' } });
        expect(() =>
          c.applyScope(fakeQb(), 'patients.view', {
            ownWhere: 'p.doctor_id = :doctorId',
          }),
        ).toThrow(/must use :employeeId/);
      });
    });
  });

  describe('decide', () => {
    it('denies without the permission', () => {
      expect(
        ctx().decide('billing.discount.apply', { value: 5, max: 10 }),
      ).toBe('deny');
    });

    it('allows within range', () => {
      const c = ctx({ permissions: { 'billing.discount.apply': true } });
      expect(c.decide('billing.discount.apply', { value: 5, max: 10 })).toBe(
        'allow',
      );
      expect(c.decide('billing.discount.apply')).toBe('allow');
    });

    it('out of range: escalation allows, approval flow asks, otherwise deny', () => {
      const basic = ctx({ permissions: { 'billing.discount.apply': true } });
      expect(
        basic.decide('billing.discount.apply', { value: 15, max: 10 }),
      ).toBe('deny');
      expect(
        basic.decide('billing.discount.apply', {
          value: 15,
          max: 10,
          approvalFlow: true,
        }),
      ).toBe('needs_approval');
      expect(basic.decide('billing.discount.apply', { value: 1, min: 2 })).toBe(
        'deny',
      );

      const custom = ctx({
        permissions: {
          'billing.discount.apply': true,
          'billing.discount.custom': true,
        },
      });
      expect(
        custom.decide('billing.discount.apply', { value: 50, max: 10 }),
      ).toBe('allow');
    });
  });
});
