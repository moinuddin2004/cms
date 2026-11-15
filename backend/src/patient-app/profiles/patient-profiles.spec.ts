import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PatientContext } from '../context/patient-context';
import { DeleteAccountDto } from '../account/delete-account.dto';
import { PatientAccountService } from '../account/patient-account.service';
import { PatientProfilesService } from './patient-profiles.service';
import { CreateProfileDto, UpdateProfileDto } from './patient-profiles.dto';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const SELF = '22222222-2222-4222-8222-222222222222';
const CHILD = '33333333-3333-4333-8333-333333333333';

const ctx = (): PatientContext => ({
  accountId: ACCOUNT,
  sessionId: 's1',
  profiles: [
    { id: SELF, relation: 'self', isSelf: true },
    { id: CHILD, relation: 'child', isSelf: false },
  ],
  links: [],
});

async function errors<T extends object>(cls: new () => T, plain: object) {
  const errs = await validate(plainToInstance(cls, plain), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errs.map((e) => e.property);
}

describe('profile DTOs', () => {
  it('create: accepts a valid family member and trims the name', async () => {
    const dto = plainToInstance(CreateProfileDto, {
      relation: 'child',
      fullName: '  Zain ',
      dob: '2018-03-03',
      gender: 'male',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.fullName).toBe('Zain');
  });

  it.each([
    [{ relation: 'self', fullName: 'A' }, 'relation'],
    [{ relation: 'child', fullName: '' }, 'fullName'],
    [{ relation: 'child', fullName: 'A'.repeat(151) }, 'fullName'],
    [{ relation: 'child', fullName: 'A', dob: '2999-01-01' }, 'dob'],
    [{ relation: 'child', fullName: 'A', dob: '2018-02-31' }, 'dob'],
    [{ relation: 'child', fullName: 'A', dob: '03/03/2018' }, 'dob'],
    [{ relation: 'child', fullName: 'A', gender: 'x' }, 'gender'],
    [{ relation: 'child', fullName: 'A', accountId: ACCOUNT }, 'accountId'],
  ])('create: rejects %j (%s)', async (body, property) => {
    expect(await errors(CreateProfileDto, body)).toContain(property);
  });

  it('update: null clears dob / gender, unknown keys are refused', async () => {
    expect(await errors(UpdateProfileDto, { dob: null, gender: null })).toEqual(
      [],
    );
    expect(await errors(UpdateProfileDto, { isSelf: true })).toContain(
      'isSelf',
    );
    expect(await errors(UpdateProfileDto, { relation: 'self' })).toContain(
      'relation',
    );
  });

  it('delete account needs the literal DELETE', async () => {
    expect(await errors(DeleteAccountDto, { confirm: 'DELETE' })).toEqual([]);
    expect(await errors(DeleteAccountDto, { confirm: 'delete' })).toContain(
      'confirm',
    );
    expect(await errors(DeleteAccountDto, {})).toContain('confirm');
  });
});

describe('PatientProfilesService guards', () => {
  const make = () => {
    const query = jest.fn().mockResolvedValue([]);
    const dataSource = {
      query,
      transaction: jest.fn(),
    };
    const links = { list: jest.fn().mockResolvedValue([]) };
    return {
      service: new PatientProfilesService(dataSource as never, links as never),
      dataSource,
      query,
    };
  };

  it('refuses a profile id that is not the account’s (404, no SQL)', async () => {
    const { service, query, dataSource } = make();
    const stranger = '44444444-4444-4444-8444-444444444444';
    await expect(
      service.update(ctx(), stranger, { fullName: 'X' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(service.remove(ctx(), stranger)).rejects.toMatchObject({
      status: 404,
    });
    expect(query).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('never removes the self profile', async () => {
    const { service, dataSource } = make();
    await expect(service.remove(ctx(), SELF)).rejects.toMatchObject({
      status: 400,
      response: { code: 'CANNOT_REMOVE_SELF' },
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('never changes the relation of the self profile', async () => {
    const { service, query } = make();
    await expect(
      service.update(ctx(), SELF, { relation: 'child' }),
    ).rejects.toMatchObject({ response: { code: 'SELF_RELATION_FIXED' } });
    expect(query).not.toHaveBeenCalled();
  });

  it('update only sets the supplied columns, scoped to the account', async () => {
    const { service, query } = make();
    query.mockResolvedValueOnce([
      {
        id: CHILD,
        relation: 'child',
        full_name: 'Z',
        dob: null,
        gender: null,
      },
    ]);
    await service
      .update(ctx(), CHILD, { fullName: 'Z', dob: null })
      .catch(() => undefined); // the re-list finds no row in this mock
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('WHERE id = $1 AND account_id = $2');
    expect(sql).toContain('full_name = $3');
    expect(sql).toContain('dob = $4');
    expect(sql).not.toContain('relation =');
    expect(sql).not.toContain('gender =');
    expect(params).toEqual([CHILD, ACCOUNT, 'Z', null]);
  });
});

describe('PatientAccountService.deleteAccount', () => {
  const LINK = {
    id: '55555555-5555-4555-8555-555555555555',
    profile_id: CHILD,
    organization_id: '66666666-6666-4666-8666-666666666666',
    patient_id: '77777777-7777-4777-8777-777777777777',
    status: 'active',
  };

  function make(accountRow: unknown[] = [{ id: ACCOUNT, email: 'A@B.test' }]) {
    const sqls: { sql: string; params?: unknown[] }[] = [];
    const manager = {
      query: jest.fn((sql: string, params?: unknown[]) => {
        sqls.push({ sql, params });
        if (sql.includes('FROM patient_accounts')) return accountRow;
        if (sql.includes('FROM patient_record_links')) return [LINK];
        return [];
      }),
    };
    const dataSource = {
      transaction: (fn: (m: unknown) => unknown) => fn(manager),
    };
    const audit = { record: jest.fn().mockResolvedValue(true) };
    return {
      service: new PatientAccountService(dataSource as never, audit as never),
      sqls,
      audit,
    };
  }

  it('revokes links, removes identities, kills sessions, strips the account', async () => {
    const { service, sqls, audit } = make();
    await expect(service.deleteAccount(ctx())).resolves.toEqual({
      deleted: true,
    });
    const all = sqls.map((s) => s.sql.replace(/\s+/g, ' '));
    const at = (needle: string) => all.findIndex((s) => s.includes(needle));

    expect(at('UPDATE patient_record_links')).toBeGreaterThan(-1);
    expect(all[at('UPDATE patient_record_links')]).toContain(
      `revoked_by_type = 'patient'`,
    );
    expect(at(`INSERT INTO patient_access_log`)).toBeGreaterThan(-1);
    expect(at('pg_notify')).toBeGreaterThan(-1);
    // links are revoked (with audit) BEFORE the profiles are deleted
    expect(at('DELETE FROM patient_profiles')).toBeGreaterThan(
      at('UPDATE patient_record_links'),
    );
    expect(at('DELETE FROM patient_account_identities')).toBeGreaterThan(-1);
    expect(at('DELETE FROM patient_login_codes')).toBeGreaterThan(-1);
    expect(all[at('UPDATE patient_sessions')]).toContain('revoked_at = now()');
    const acct = all[at('UPDATE patient_accounts')];
    expect(acct).toContain(`status = 'deleted'`);
    expect(acct).toContain('full_name = NULL');
    expect(sqls.find((s) => s.sql.includes('login_codes'))?.params).toEqual([
      'a@b.test',
    ]);

    // one clinic audit row for the link, one platform row for the account
    expect(audit.record).toHaveBeenCalledTimes(2);
    const entries = (audit.record.mock.calls as unknown[][]).map(
      (c) => c[2] as Record<string, unknown>,
    );
    expect(entries[0]).toMatchObject({
      organizationId: LINK.organization_id,
      entityType: 'patient_app_link',
      entityId: LINK.id,
      subjectId: LINK.patient_id,
    });
    expect(entries[1]).toMatchObject({
      organizationId: null,
      entityType: 'patient_account',
      entityId: ACCOUNT,
    });
    expect(JSON.stringify(entries)).not.toContain('A@B.test');
  });

  it('a second delete (account already gone) is a 404 and writes nothing', async () => {
    const { service, sqls, audit } = make([]);
    await expect(service.deleteAccount(ctx())).rejects.toMatchObject({
      status: 404,
    });
    expect(sqls).toHaveLength(1);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
