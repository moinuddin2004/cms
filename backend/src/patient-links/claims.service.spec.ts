import { ClaimsService } from './claims.service';
import { hashClaimToken } from './claim-token';

/** pg parses `date` into a JS Date; the claim queries must hand back 'YYYY-MM-DD' text. */
describe('ClaimsService.preview dob handling', () => {
  const token = 'T'.repeat(43);
  const queries: string[] = [];

  function make(dob: unknown) {
    const query = jest.fn((sql: string, params?: unknown[]) => {
      queries.push(sql);
      if (sql.includes('FROM patient_claim_tokens')) {
        expect(params).toEqual([hashClaimToken(token)]);
        return Promise.resolve([
          {
            id: 't1',
            organization_id: 'o1',
            patient_id: 'p1',
            created_by_user_id: 'u1',
            patient_full_name: 'Ali Raza Khan',
            patient_dob: dob,
            patient_gender: null,
            patient_is_minor: false,
            patient_is_active: true,
            primary_location_id: null,
          },
        ]);
      }
      if (sql.includes('FROM organizations')) {
        return Promise.resolve([{ name: 'Clinic' }]);
      }
      return Promise.resolve([]);
    });
    const dataSource = { manager: { query } };
    const eligibility = { check: jest.fn().mockResolvedValue('ok') };
    return new ClaimsService(
      dataSource as never,
      {} as never,
      eligibility as never,
    );
  }

  const ctx = { accountId: 'a1', links: [], profiles: [] } as never;

  it('bands the age from a text dob', async () => {
    const res = await make('1990-05-05').preview(ctx, token);
    expect(res.ageBand).toBe('18-39');
    expect(res.maskedName).toBe('Ali R. K.');
  });

  it('every dob the service selects is cast to text', async () => {
    await make('1990-05-05').preview(ctx, token);
    const claimSql = queries.find((q) =>
      q.includes('FROM patient_claim_tokens'),
    )!;
    expect(claimSql).toContain('p.dob::text AS patient_dob');
  });

  it('a Date-typed dob would NOT band (documents why the cast matters)', async () => {
    const res = await make(new Date('1990-05-05')).preview(ctx, token);
    expect(res.ageBand).toBeNull();
  });
});

/** A concurrent / completed account deletion must stop a claim accept (A-22 rework). */
describe('ClaimsService.accept with a deleted account', () => {
  const token = 'T'.repeat(43);

  it('locks the account row and answers 404 when it is gone, before touching profiles or links', async () => {
    const sqls: string[] = [];
    const query = jest.fn((sql: string) => {
      sqls.push(sql.replace(/\s+/g, ' '));
      if (sql.includes('FROM patient_claim_tokens')) {
        return Promise.resolve([
          {
            id: 't1',
            organization_id: 'o1',
            patient_id: 'p1',
            created_by_user_id: 'u1',
            patient_full_name: 'Ali Raza Khan',
            patient_dob: null,
            patient_gender: null,
            patient_is_minor: false,
            patient_is_active: true,
            primary_location_id: null,
          },
        ]);
      }
      return Promise.resolve([]); // the account lock finds nothing
    });
    const dataSource = {
      transaction: (fn: (m: unknown) => unknown) => fn({ query }),
    };
    const service = new ClaimsService(
      dataSource as never,
      {} as never,
      { check: jest.fn().mockResolvedValue('ok') } as never,
    );
    const ctx = { accountId: 'a1', links: [], profiles: [] } as never;

    await expect(
      service.accept(ctx, token, { relation: 'self', confirm: true }, null),
    ).rejects.toMatchObject({ status: 404 });

    const lock = sqls.find((s) => s.includes('FROM patient_accounts'))!;
    expect(lock).toContain('deleted_at IS NULL FOR UPDATE');
    expect(sqls.some((s) => s.includes('INSERT INTO'))).toBe(false);
    expect(sqls.some((s) => s.includes('patient_profiles'))).toBe(false);
  });
});

describe('ClaimsService.accept profile cap (audit L3)', () => {
  const token = 'T'.repeat(43);

  function make(profileCount: number) {
    const sqls: string[] = [];
    const query = jest.fn((sql: string) => {
      sqls.push(sql.replace(/\s+/g, ' '));
      if (sql.includes('FROM patient_claim_tokens')) {
        return Promise.resolve([
          {
            id: 't1',
            organization_id: 'o1',
            patient_id: 'p1',
            created_by_user_id: 'u1',
            patient_full_name: 'Ali Raza Khan',
            patient_dob: null,
            patient_gender: null,
            patient_is_minor: false,
            patient_is_active: true,
            primary_location_id: null,
          },
        ]);
      }
      if (sql.includes('FROM patient_accounts')) {
        return Promise.resolve([{ full_name: 'Me' }]);
      }
      if (sql.includes('count(*)'))
        return Promise.resolve([{ n: profileCount }]);
      return Promise.resolve([]); // no existing link, no existing self profile
    });
    const dataSource = {
      transaction: (fn: (m: unknown) => unknown) => fn({ query }),
    };
    const service = new ClaimsService(
      dataSource as never,
      {} as never,
      { check: jest.fn().mockResolvedValue('ok') } as never,
    );
    return { service, sqls };
  }
  const ctx = { accountId: 'a1', links: [], profiles: [] } as never;

  it('refuses to create a 21st profile through a claim, before inserting', async () => {
    const { service, sqls } = make(20);
    await expect(
      service.accept(
        ctx,
        token,
        { relation: 'child', newProfileName: 'Zain', confirm: true },
        null,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(sqls.some((s) => s.includes('INSERT INTO patient_profiles'))).toBe(
      false,
    );
  });

  it('under the cap the profile is created', async () => {
    const { service, sqls } = make(3);
    await service
      .accept(
        ctx,
        token,
        { relation: 'child', newProfileName: 'Zain', confirm: true },
        null,
      )
      .catch(() => undefined); // later steps need more rows than this stub gives
    expect(sqls.some((s) => s.includes('INSERT INTO patient_profiles'))).toBe(
      true,
    );
  });
});
